"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { SubNavItem } from "@/components/atoms/sub-nav-item";
import { TokenIcon } from "@/components/atoms/token-icon";
import { DetailRows } from "@/components/molecules/detail-rows";
import { FilterDropdown } from "@/components/molecules/filter-dropdown";
import { StatusPill } from "@/components/molecules/status-pill";
import { AppShell } from "@/components/organisms/app-shell";
import { ConfirmTransactionModal } from "@/components/organisms/confirm-transaction-modal";
import { Button as UiButton } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  fetchWalletAssets,
  parseWalletAddress,
  type SolanaCluster,
} from "@/lib/wallet/assets";
import { fetchMarkets, type Market } from "@/lib/api/markets";
import { fetchPool, type Pool } from "@/lib/api/pool";
import { fetchPositions, type Position } from "@/lib/api/positions";
import { buildAddLiquidityTx, buildRemoveLiquidityTx } from "@/lib/api/tx";
import { useSendUnsignedTx } from "@/lib/wallet/send-transaction";
import { cn } from "@/lib/utils";
import { TOKEN_FILTER_OPTIONS, TOKEN_ICONS } from "@/lib/wallet/token-icons";

type LiquidityTab = "add" | "remove" | "position";

type LiquidityQuote = {
  action: string;
  rows: { label: string; value: string; valueClassName?: string }[];
  note: string;
  onConfirm: () => Promise<void>;
};

type MarketPool = {
  market: Market;
  pool: Pool;
};

const TABS: { id: LiquidityTab; label: string }[] = [
  { id: "add", label: "Add" },
  { id: "remove", label: "Remove" },
  { id: "position", label: "My Position" },
];

const PAGE_COPY = {
  title: "Provide liquidity, earn the spread",
  subtitle:
    "Underwrite the AMM pool and earn a share of trading fees for taking on UP-side risk. Add or withdraw at any time before expiry.",
} as const;

const USDC_DECIMALS = 6;

function parseTab(value: string | null): LiquidityTab {
  if (value === "remove" || value === "position" || value === "add") {
    return value;
  }
  return "add";
}

function formatUsd(value: number, digits = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatTokenAmount(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

function parseAmount(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === ".") return null;
  const next = Number(cleaned);
  if (!Number.isFinite(next) || next < 0) return null;
  return next;
}

function clusterFromNetwork(networkId: string | undefined): SolanaCluster {
  if (!networkId) {
    return process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet" ? "mainnet" : "devnet";
  }
  if (networkId.includes("EtWTRABZaYq6iMfeYKouRu166VU2xqa1") || networkId.includes("devnet")) {
    return "devnet";
  }
  return "mainnet";
}

function fromBaseUnits(raw: string, decimals = USDC_DECIMALS): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return value / 10 ** decimals;
}

function toBaseUnits(uiAmount: number, decimals = USDC_DECIMALS): string {
  return Math.max(0, Math.round(uiAmount * 10 ** decimals)).toString();
}

function nameFor(symbol: string): string {
  if (symbol === "SOL") return "Solana";
  if (symbol === "BTC") return "Bitcoin";
  if (symbol === "ETH") return "Ethereum";
  return symbol;
}

function iconFor(symbol: string): string | null {
  return TOKEN_ICONS[symbol] ?? null;
}

function tvlOf(pool: Pool): number {
  return fromBaseUnits(pool.poolDownBalance) + fromBaseUnits(pool.poolUpBalance);
}

function utilizationOf(pool: Pool): number {
  const qDown = Number(pool.qDown);
  const qUp = Number(pool.qUp);
  const total = Math.abs(qDown) + Math.abs(qUp);
  if (total === 0) return 0;
  return Math.round((Math.abs(qDown) / total) * 100);
}

function useMarketPools(refreshKey: number) {
  const [pools, setPools] = useState<MarketPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMarkets({ status: "active" })
      .then(async (markets) => {
        const settled = await Promise.all(
          markets.map(async (market) => {
            try {
              const pool = await fetchPool(market.address);
              return { market, pool };
            } catch {
              return null;
            }
          }),
        );
        if (!cancelled) {
          setPools(settled.filter((item): item is MarketPool => item !== null));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load pools.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { pools, loading, error };
}

export function LiquidityPoolFlow() {
  return (
    <Suspense
      fallback={
        <AppShell lockViewport>
          <main className="mx-auto h-full w-full max-w-[1140px] px-4 xl:px-0" />
        </AppShell>
      }
    >
      <LiquidityPageContent />
    </Suspense>
  );
}

function LiquidityPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);
  const [confirmOpen, setConfirmOpen] = useState(
    () => searchParams.get("confirm") === "1",
  );
  const [quote, setQuote] = useState<LiquidityQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { pools, loading: poolsLoading, error: poolsError } = useMarketPools(refreshKey);

  useEffect(() => {
    setConfirmOpen(searchParams.get("confirm") === "1");
  }, [searchParams]);

  const setTab = useCallback(
    (next: LiquidityTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "add") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      params.delete("confirm");
      setConfirmOpen(false);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openConfirm = useCallback(
    (next: LiquidityQuote) => {
      setQuote(next);
      setSubmitError(null);
      const params = new URLSearchParams(searchParams.toString());
      params.set("confirm", "1");
      if (tab !== "add") {
        params.set("tab", tab);
      }
      setConfirmOpen(true);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, tab],
  );

  const closeConfirm = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("confirm");
    setConfirmOpen(false);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleConfirm = useCallback(async () => {
    if (!quote) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await quote.onConfirm();
      closeConfirm();
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setSubmitting(false);
    }
  }, [closeConfirm, quote]);

  return (
    <AppShell lockViewport>
      <main className="mx-auto flex h-full min-h-0 w-full max-w-[1140px] flex-col gap-4 px-4 py-6 sm:gap-5 sm:py-8 xl:px-0 xl:py-16">
        <header className="flex w-full shrink-0 flex-col gap-2 sm:gap-3">
          <h1 className="m-0 max-w-[22ch] text-balance font-display text-[24px] font-bold leading-8 tracking-[-0.24px] text-neutrals-8 sm:text-[32px] sm:leading-10 sm:tracking-[-0.32px]">
            {PAGE_COPY.title}
          </h1>
          <p className="m-0 max-w-[65ch] text-pretty font-body text-caption-2 leading-5 text-neutrals-5">
            {PAGE_COPY.subtitle}
          </p>
        </header>

        <div className="flex min-h-0 w-full flex-1 flex-col gap-4 sm:gap-[34px]">
          <div className="flex shrink-0 items-center py-2 sm:py-4">
            <div className="flex items-start gap-3">
              {TABS.map((item) => (
                <SubNavItem
                  key={item.id}
                  theme="dark"
                  active={tab === item.id}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </SubNavItem>
              ))}
            </div>
          </div>

          {poolsError ? (
            <p className="m-0 font-body text-caption-2 text-primary-3" role="alert">
              {poolsError}
            </p>
          ) : null}

          {tab === "add" ? (
            <AddPanel onConfirm={openConfirm} pools={pools} loading={poolsLoading} />
          ) : null}
          {tab === "remove" ? (
            <RemovePanel onConfirm={openConfirm} pools={pools} refreshKey={refreshKey} />
          ) : null}
          {tab === "position" ? (
            <PositionsPanel onAdd={() => setTab("add")} pools={pools} refreshKey={refreshKey} />
          ) : null}
        </div>
      </main>

      <ConfirmTransactionModal
        open={confirmOpen && (quote?.rows.length ?? 0) > 0}
        action={quote?.action}
        rows={
          quote && quote.rows.length > 0
            ? [{ label: "Action", value: quote.action }, ...quote.rows]
            : undefined
        }
        note={submitError ?? quote?.note}
        onCancel={closeConfirm}
        onConfirm={handleConfirm}
      />
      {submitting ? (
        <p className="sr-only" role="status">
          Waiting for wallet confirmation…
        </p>
      ) : null}
    </AppShell>
  );
}

function AssetSelect({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  options: { id: string; symbol: string; name: string; iconUrl: string | null }[];
  disabled?: boolean;
}) {
  const selected = options.find((item) => item.id === value) ?? options[0];

  return (
    <Select value={selected?.id ?? value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label="Select pool"
        className="group h-auto min-w-0 max-w-[217px] flex-1 gap-[10px] rounded-pill border-0 bg-neutrals-2 px-3 py-2 text-neutrals-8 transition-colors duration-200 hover:bg-neutrals-3 focus-visible:border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-1 sm:w-[217px] sm:flex-none sm:px-4"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <TokenIcon src={selected?.iconUrl ?? TOKEN_ICONS[selected?.symbol ?? ""] ?? null} symbol={selected?.symbol ?? "?"} />
          <span className="truncate font-body text-sm font-medium leading-6 text-neutrals-8">
            {selected?.symbol ?? "SOL"}
          </span>
          <span className="hidden truncate font-body text-sm leading-6 text-neutrals-4 sm:inline">
            {selected?.name ?? "Solana"}
          </span>
        </span>
        <img
          src="/icons/arrow-down-simple-line.svg"
          alt=""
          width={24}
          height={24}
          className="size-6 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </SelectTrigger>
      <SelectContent
        align="start"
        className="w-[min(360px,calc(100vw-2rem))] rounded-[10px] border-neutrals-3 bg-neutrals-2"
      >
        {options.map((item) => (
          <SelectItem
            key={item.id}
            value={item.id}
            className="w-full text-neutrals-8 focus:bg-neutrals-3"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <TokenIcon src={item.iconUrl} symbol={item.symbol} />
              <span className="truncate font-body text-sm font-medium leading-6">
                {item.symbol}
              </span>
              <span className="truncate font-body text-sm leading-6 text-neutrals-4">
                {item.name}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function utilizationBand(value: number) {
  if (value < 34) return "low";
  if (value < 67) return "medium";
  return "high";
}

function UtilizationBar({ value }: { value: number }) {
  const [current, setCurrent] = useState(value);
  const band = utilizationBand(current);

  useEffect(() => {
    setCurrent(value);
  }, [value]);

  return (
    <div className="flex w-full flex-col justify-center gap-2.5 rounded-[10px] border border-neutrals-4 bg-neutrals-1 px-4 py-4 sm:px-6">
      <div className="flex h-[33px] w-full items-center justify-between font-body font-medium text-neutrals-8">
        <span className="text-base leading-6">Pool skew</span>
        <span className="text-sm leading-6 tabular-nums">{current}%</span>
      </div>
      <Slider
        variant="coverage"
        min={0}
        max={100}
        step={1}
        value={[current]}
        aria-label="Pool skew"
        disabled
      />
      <div className="flex h-[33px] w-full items-center justify-between font-body text-caption-2">
        <span className={cn("leading-5", band === "low" ? "font-medium text-neutrals-8" : "text-neutrals-4")}>
          Low
        </span>
        <span className={cn("leading-5", band === "medium" ? "font-medium text-neutrals-8" : "text-neutrals-4")}>
          Medium
        </span>
        <span className={cn("leading-5", band === "high" ? "font-medium text-neutrals-8" : "text-neutrals-4")}>
          High
        </span>
      </div>
    </div>
  );
}

function AddPanel({
  onConfirm,
  pools,
  loading,
}: {
  onConfirm: (quote: LiquidityQuote) => void;
  pools: MarketPool[];
  loading: boolean;
}) {
  const { address } = useAppKitAccount();
  const { caipNetworkId } = useAppKitNetwork();
  const cluster = clusterFromNetwork(
    typeof caipNetworkId === "string" ? caipNetworkId : undefined,
  );
  const sendTx = useSendUnsignedTx();
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [amountInput, setAmountInput] = useState("500");

  useEffect(() => {
    if (!selectedId && pools.length > 0) {
      setSelectedId(pools[0].market.address);
    }
  }, [pools, selectedId]);

  useEffect(() => {
    if (!address) return;
    const owner = parseWalletAddress(address);
    let cancelled = false;
    setAssetsLoading(true);
    setAssetsError(null);
    fetchWalletAssets(owner, cluster)
      .then((payload) => {
        if (cancelled) return;
        setUsdcBalance(payload.usdcBalance);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAssetsError(error instanceof Error ? error.message : "Couldn't load wallet assets.");
      })
      .finally(() => {
        if (!cancelled) setAssetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, cluster]);

  const entry = pools.find((item) => item.market.address === selectedId) ?? pools[0];
  const amount = parseAmount(amountInput);
  const exceedsBalance =
    !assetsLoading && amount !== null && amount > usdcBalance + 0.0001;
  const canSubmit =
    !assetsLoading && Boolean(entry) && amount !== null && amount > 0 && !exceedsBalance;
  const lpTokens = amount ?? 0;
  const tvl = entry ? tvlOf(entry.pool) : 0;
  const utilization = entry ? utilizationOf(entry.pool) : 0;
  const feePercent = entry ? entry.pool.feeBps / 100 : 0;

  function handleAmountChange(value: string) {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmountInput(value);
    }
  }

  if (!loading && pools.length === 0) {
    return (
      <div className="flex w-full flex-col items-start gap-2 rounded-[10px] bg-neutrals-2 px-6 py-8">
        <p className="m-0 font-body text-sm font-medium leading-6 text-neutrals-8">
          No pools available yet
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-x-[49px] lg:gap-y-8">
      <div className="flex flex-col gap-5 lg:gap-[25px]">
        <div className="flex min-h-12 w-full items-center justify-between gap-3">
          <AssetSelect
            value={selectedId}
            onChange={setSelectedId}
            disabled={loading}
            options={pools.map((item) => ({
              id: item.market.address,
              symbol: item.market.assetSymbol,
              name: nameFor(item.market.assetSymbol),
              iconUrl: iconFor(item.market.assetSymbol),
            }))}
          />
          <div className="flex flex-col items-end justify-center font-body text-sm font-medium leading-6 tabular-nums">
            <span className="text-neutrals-8">${formatUsd(tvl, 0)}</span>
            <span className="text-[#8b5cf6]">{feePercent.toFixed(2)}% fee</span>
          </div>
        </div>
        {assetsError ? (
          <p className="m-0 w-full font-body text-caption-2 text-primary-3" role="alert">
            {assetsError}
          </p>
        ) : null}

        <div
          className={cn(
            "flex w-full flex-col gap-4 rounded-[10px] border bg-neutrals-1 px-4 py-5 transition-colors duration-200 focus-within:border-primary-1 sm:px-[33px] sm:py-6",
            exceedsBalance ? "border-primary-3" : "border-neutrals-3",
          )}
        >
          <div className="flex min-h-12 w-full flex-col items-start gap-1 sm:h-12 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <label className="sr-only" htmlFor="lp-deposit-amount">
              Deposit amount in USDC
            </label>
            <input
              id="lp-deposit-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountInput}
              onChange={(event) => handleAmountChange(event.target.value)}
              className="min-w-0 w-full border-none bg-transparent p-0 font-display text-[32px] font-bold leading-10 tracking-[-0.32px] text-neutrals-8 caret-primary-1 tabular-nums outline-none placeholder:text-neutrals-4 sm:flex-1 sm:text-[40px] sm:leading-[48px] sm:tracking-[-0.4px]"
              placeholder="0"
            />
            <span className="shrink-0 font-body text-sm font-medium leading-6 text-neutrals-5 tabular-nums sm:text-base">
              ≈ ${formatUsd(amount ?? 0)} USDC
            </span>
          </div>
          <div className="flex w-full items-end justify-between gap-4 sm:items-center">
            <div className="font-body text-caption-2 tabular-nums">
              {assetsLoading ? (
                <span className="mt-0.5 block h-5 w-48 animate-pulse rounded bg-neutrals-3" />
              ) : (
                <>
                  <p className={cn("m-0 leading-5", exceedsBalance ? "text-primary-3" : "text-neutrals-4")}>
                    Available balance: {formatUsd(usdcBalance)} USDC
                  </p>
                  {exceedsBalance ? (
                    <p className="m-0 leading-5 text-primary-3" role="alert">
                      Amount exceeds available balance.
                    </p>
                  ) : null}
                </>
              )}
            </div>
            <UiButton
              type="button"
              variant="dark"
              size="small"
              disabled={assetsLoading}
              onClick={() => setAmountInput(String(Math.floor(usdcBalance * 100) / 100))}
            >
              Max
            </UiButton>
          </div>
        </div>

        <UtilizationBar value={utilization} />
      </div>

      <aside className="flex h-auto min-h-0 flex-col gap-6 rounded-[10px] bg-neutrals-2 px-5 py-5 shadow-[inset_0_1px_0_rgba(252,252,253,0.06)] sm:px-8 sm:py-4 lg:h-full lg:gap-8">
        <div className="flex w-full flex-col gap-1">
          <p className="m-0 font-body text-body-2 text-neutrals-5">You deposit</p>
          <p className="m-0 font-display text-[32px] font-bold leading-10 tracking-[-0.32px] text-neutrals-8 tabular-nums">
            ${formatUsd(amount ?? 0)}
          </p>
          <p className="m-0 font-body text-body-2 text-neutrals-5">
            into the {entry?.market.assetSymbol ?? "-"} pool
          </p>
        </div>
        <div className="h-px w-full bg-neutrals-3" />
        <DetailRows
          variant="flush"
          className="min-h-0 flex-1"
          rows={[
            { label: "Pool TVL", value: `$${formatUsd(tvl)}` },
            { label: "Fee rate", value: `${feePercent.toFixed(2)}%` },
            {
              label: "LP tokens received",
              value: `${formatTokenAmount(lpTokens)} LP`,
              valueClassName: "text-primary-4",
            },
            { label: "Withdrawal", value: "Anytime, subject to liquidity" },
          ]}
        />
        <UiButton
          type="button"
          variant="neutral"
          size="medium"
          className="mt-auto h-12 w-full whitespace-normal sm:whitespace-nowrap"
          disabled={!canSubmit}
          onClick={() => {
            if (!entry || !address || amount === null) return;
            onConfirm({
              action: "Add liquidity",
              rows: [
                { label: "Pool", value: `${entry.market.assetSymbol} · ${nameFor(entry.market.assetSymbol)}` },
                {
                  label: "Deposit",
                  value: `${formatUsd(amount)} USDC`,
                  valueClassName: "text-primary-4",
                },
                { label: "LP tokens", value: `${formatTokenAmount(lpTokens)} LP` },
                { label: "Network fee", value: "~0.00025 SOL" },
              ],
              note: "USDC is deposited into the AMM pool. You can withdraw before expiry, subject to available liquidity.",
              onConfirm: async () => {
                const owner = parseWalletAddress(address);
                const base64 = await buildAddLiquidityTx({
                  market: entry.market.address,
                  usdcAmount: toBaseUnits(amount),
                  wallet: owner,
                });
                await sendTx(base64);
              },
            });
          }}
        >
          {canSubmit
            ? `Add liquidity for $${formatUsd(amount ?? 0)}`
            : exceedsBalance
              ? "Amount exceeds available balance"
              : "Enter a deposit amount"}
        </UiButton>
      </aside>
    </div>
  );
}

function RemovePanel({
  onConfirm,
  pools,
  refreshKey,
}: {
  onConfirm: (quote: LiquidityQuote) => void;
  pools: MarketPool[];
  refreshKey: number;
}) {
  const { address } = useAppKitAccount();
  const sendTx = useSendUnsignedTx();
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!address) {
      setPositions([]);
      return;
    }
    const owner = parseWalletAddress(address);
    let cancelled = false;
    fetchPositions(owner)
      .then((data) => {
        if (!cancelled) setPositions(data.filter((position) => Number(position.lpBalance) > 0));
      })
      .catch(() => {
        if (!cancelled) setPositions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  useEffect(() => {
    if (!selectedId && positions.length > 0) {
      setSelectedId(positions[0].market);
    }
  }, [positions, selectedId]);

  const position = positions.find((item) => item.market === selectedId) ?? positions[0];
  const entry = pools.find((item) => item.market.address === position?.market);
  const [amountInput, setAmountInput] = useState("0");

  useEffect(() => {
    if (position) setAmountInput(fromBaseUnits(position.lpBalance).toString());
  }, [position?.market]);

  const lpBalance = position ? fromBaseUnits(position.lpBalance) : 0;
  const amount = parseAmount(amountInput);
  const exceedsBalance = amount !== null && amount > lpBalance + 0.0001;
  const canSubmit = Boolean(position) && amount !== null && amount > 0 && !exceedsBalance;

  const lpSupply = entry ? fromBaseUnits(entry.pool.lpSupply) : 0;
  const share = lpSupply > 0 ? (amount ?? 0) / lpSupply : 0;
  const tvl = entry ? tvlOf(entry.pool) : 0;
  const receiveUsd = share * tvl;

  function applyPosition(nextId: string) {
    setSelectedId(nextId);
  }

  function handleAmountChange(value: string) {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmountInput(value);
    }
  }

  if (!position) {
    return (
      <div className="flex w-full flex-col items-start gap-2 rounded-[10px] bg-neutrals-2 px-6 py-8">
        <p className="m-0 font-body text-sm font-medium leading-6 text-neutrals-8">
          No liquidity to withdraw
        </p>
        <p className="m-0 max-w-[42ch] font-body text-caption-2 text-neutrals-4">
          Add liquidity to a pool first, then you can withdraw it here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-x-[49px] lg:gap-y-8">
      <div className="flex flex-col gap-5 lg:gap-[25px]">
        <div className="flex min-h-12 w-full items-center justify-between gap-3">
          <AssetSelect
            value={selectedId}
            onChange={applyPosition}
            options={positions.map((item) => ({
              id: item.market,
              symbol: item.assetSymbol,
              name: nameFor(item.assetSymbol),
              iconUrl: iconFor(item.assetSymbol),
            }))}
          />
          <div className="flex flex-col items-end justify-center font-body text-sm font-medium leading-6 tabular-nums">
            <span className="text-neutrals-8">{formatTokenAmount(lpBalance)}</span>
            <span className="text-neutrals-5">Your LP tokens</span>
          </div>
        </div>

        <div
          className={cn(
            "flex w-full flex-col gap-4 rounded-[10px] border bg-neutrals-1 px-4 py-5 transition-colors duration-200 focus-within:border-primary-1 sm:px-[33px] sm:py-6",
            exceedsBalance ? "border-primary-3" : "border-neutrals-3",
          )}
        >
          <div className="flex min-h-12 w-full flex-col items-start gap-1 sm:h-12 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <label className="sr-only" htmlFor="lp-withdraw-amount">
              Withdraw amount in LP tokens
            </label>
            <input
              id="lp-withdraw-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountInput}
              onChange={(event) => handleAmountChange(event.target.value)}
              className="min-w-0 w-full border-none bg-transparent p-0 font-display text-[32px] font-bold leading-10 tracking-[-0.32px] text-neutrals-8 caret-primary-1 tabular-nums outline-none placeholder:text-neutrals-4 sm:flex-1 sm:text-[40px] sm:leading-[48px] sm:tracking-[-0.4px]"
              placeholder="0"
            />
            <span className="shrink-0 font-body text-sm font-medium leading-6 text-neutrals-5 tabular-nums sm:text-base">
              ≈ ${formatUsd(receiveUsd)}
            </span>
          </div>
          <div className="flex w-full items-end justify-between gap-4 sm:items-center">
            <div className="font-body text-caption-2 tabular-nums">
              <p className={cn("m-0 leading-5", exceedsBalance ? "text-primary-3" : "text-neutrals-4")}>
                Available to withdraw: {formatTokenAmount(lpBalance)} LP
              </p>
              {exceedsBalance ? (
                <p className="m-0 leading-5 text-primary-3" role="alert">
                  Amount exceeds your LP balance.
                </p>
              ) : null}
            </div>
            <UiButton
              type="button"
              variant="dark"
              size="small"
              onClick={() => setAmountInput(String(lpBalance))}
            >
              Max
            </UiButton>
          </div>
        </div>

        <UtilizationBar value={entry ? utilizationOf(entry.pool) : 0} />
      </div>

      <aside className="flex h-auto min-h-0 flex-col gap-6 rounded-[10px] bg-neutrals-2 px-5 py-5 shadow-[inset_0_1px_0_rgba(252,252,253,0.06)] sm:px-8 sm:py-4 lg:h-full lg:gap-8">
        <div className="flex w-full flex-col gap-1">
          <p className="m-0 font-body text-body-2 text-neutrals-5">You receive</p>
          <p className="m-0 font-display text-[32px] font-bold leading-10 tracking-[-0.32px] text-neutrals-8 tabular-nums">
            ${formatUsd(receiveUsd)}
          </p>
          <p className="m-0 font-body text-body-2 text-neutrals-5">
            {(share * 100).toFixed(2)}% of the pool
          </p>
        </div>
        <div className="h-px w-full bg-neutrals-3" />
        <DetailRows
          variant="flush"
          className="min-h-0 flex-1"
          rows={[
            { label: "LP tokens", value: `${formatTokenAmount(amount ?? 0)} LP` },
            {
              label: "You'll receive",
              value: `${formatUsd(receiveUsd)} USDC`,
              valueClassName: "text-primary-4",
            },
            { label: "Withdrawal", value: "Instant, pool has liquidity" },
          ]}
        />
        <UiButton
          type="button"
          variant="neutral"
          size="medium"
          className="mt-auto h-12 w-full whitespace-normal sm:whitespace-nowrap"
          disabled={!canSubmit}
          onClick={() => {
            if (!address || amount === null) return;
            onConfirm({
              action: "Withdraw liquidity",
              rows: [
                { label: "Pool", value: `${position.assetSymbol} · ${nameFor(position.assetSymbol)}` },
                { label: "LP tokens", value: `${formatTokenAmount(amount)} LP` },
                {
                  label: "You receive",
                  value: `${formatUsd(receiveUsd)} USDC`,
                  valueClassName: "text-primary-4",
                },
                { label: "Network fee", value: "~0.00025 SOL" },
              ],
              note: "LP tokens are burned and USDC returns to your wallet, including your share of earned fees.",
              onConfirm: async () => {
                const owner = parseWalletAddress(address);
                const base64 = await buildRemoveLiquidityTx({
                  market: position.market,
                  lpAmount: toBaseUnits(amount),
                  wallet: owner,
                });
                await sendTx(base64);
              },
            });
          }}
        >
          {canSubmit
            ? `Withdraw ${formatTokenAmount(amount ?? 0)} LP`
            : exceedsBalance
              ? "Amount exceeds your LP balance"
              : "Enter a withdraw amount"}
        </UiButton>
      </aside>
    </div>
  );
}

function PositionsPanel({
  onAdd,
  pools,
  refreshKey,
}: {
  onAdd: () => void;
  pools: MarketPool[];
  refreshKey: number;
}) {
  const { address } = useAppKitAccount();
  const [token, setToken] = useState("all");
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setPositions([]);
      setLoading(false);
      return;
    }
    const owner = parseWalletAddress(address);
    let cancelled = false;
    setLoading(true);
    fetchPositions(owner)
      .then((data) => {
        if (!cancelled) setPositions(data.filter((position) => Number(position.lpBalance) > 0));
      })
      .catch(() => {
        if (!cancelled) setPositions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  const rows = positions.filter((row) => token === "all" || row.assetSymbol === token);

  if (loading) {
    return <div className="h-24 w-full animate-pulse rounded-[10px] bg-neutrals-2" />;
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 lg:overflow-hidden">
      <FilterDropdown
        label="Token"
        aria-label="Filter by token"
        className="max-w-[280px] shrink-0"
        value={token}
        onChange={setToken}
        options={TOKEN_FILTER_OPTIONS}
      />
      {rows.length === 0 ? (
        <div className="flex w-full flex-col items-start gap-2 rounded-[10px] bg-neutrals-2 px-6 py-8">
          <p className="m-0 font-body text-sm font-medium leading-6 text-neutrals-8">
            No positions match this filter
          </p>
          <p className="m-0 max-w-[42ch] font-body text-caption-2 text-neutrals-4">
            Choose another token, or open Add to deposit into a pool.
          </p>
          <button
            type="button"
            className="mt-1 font-display text-sm font-bold leading-4 text-neutrals-8 transition-colors duration-200 hover:text-neutrals-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-1"
            onClick={onAdd}
          >
            Open Add
          </button>
        </div>
      ) : (
        <div className="min-h-0 w-full flex-1 overflow-x-auto lg:overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="sticky top-0 bg-neutrals-1">
              <tr className="border-b border-neutrals-3">
                <th className="px-4 py-3 font-body text-caption-2 font-medium text-neutrals-4">Asset</th>
                <th className="px-4 py-3 font-body text-caption-2 font-medium text-neutrals-4">LP tokens</th>
                <th className="px-4 py-3 font-body text-caption-2 font-medium text-neutrals-4">Share</th>
                <th className="px-4 py-3 font-body text-caption-2 font-medium text-neutrals-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const entry = pools.find((item) => item.market.address === row.market);
                const lpSupply = entry ? fromBaseUnits(entry.pool.lpSupply) : 0;
                const lpBalance = fromBaseUnits(row.lpBalance);
                const share = lpSupply > 0 ? (lpBalance / lpSupply) * 100 : 0;
                return (
                  <tr key={row.market} className="border-b border-neutrals-3 last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <TokenIcon src={iconFor(row.assetSymbol)} symbol={row.assetSymbol} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-body text-sm font-medium leading-6 text-neutrals-8">
                            {row.assetSymbol}
                          </span>
                          <span className="truncate font-body text-caption-2 text-neutrals-4">
                            {nameFor(row.assetSymbol)}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-body text-sm leading-6 text-neutrals-8 tabular-nums">
                      {formatTokenAmount(lpBalance)}
                    </td>
                    <td className="px-4 py-3 font-body text-sm leading-6 text-neutrals-8 tabular-nums">
                      {share.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill>Earning</StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
