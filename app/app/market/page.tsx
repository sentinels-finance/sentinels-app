"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  fetchWalletAssets,
  parseWalletAddress,
  type SolanaCluster,
  type WalletAsset,
} from "@/lib/wallet/assets";
import { fetchMarkets, type Market } from "@/lib/api/markets";
import { fetchPool, type Pool } from "@/lib/api/pool";
import { fetchPositions, type Position } from "@/lib/api/positions";
import { buildProtectTx, buildRedeemTx } from "@/lib/api/tx";
import { useSendUnsignedTx } from "@/lib/wallet/send-transaction";
import { lmsrSwapAmountOut, applyLmsrFee } from "@/lib/lmsr";
import { cn } from "@/lib/utils";
import { APP_ASSETS, TOKEN_FILTER_OPTIONS } from "@/lib/wallet/token-icons";

type MarketTab = "protect" | "positions" | "history";

type ProtectQuote = {
  coverage: string;
  youPay: string;
  market: string;
  amountBaseUnits: string;
  minDownOutBaseUnits: string;
};

const TABS: { id: MarketTab; label: string }[] = [
  { id: "protect", label: "Protect" },
  { id: "positions", label: "Positions" },
  { id: "history", label: "History" },
];

const PAGE_COPY = {
  title: "Downside protection, fully collateralized",
  subtitle:
    "Every policy is backed 1:1 by USDC in an on-chain vault. Payouts settle when Pyth confirms a decline. No claims, no counterparty risk.",
} as const;

const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_DECIMALS = 6;
const PROTECT_SLIPPAGE_BPS = 100; // 1% tolerance between quoted and actually-filled minDownOut

const [SOL, CBBTC, WBTC] = APP_ASSETS;

function parseTab(value: string | null): MarketTab {
  if (value === "positions" || value === "history" || value === "protect") {
    return value;
  }
  return "protect";
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

function maxAmountFor(price: number, usdcBalance: number) {
  if (!(price > 0)) return 0;
  return Math.floor((usdcBalance / price) * 100) / 100;
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

function toBaseUnits(uiAmount: number, decimals = USDC_DECIMALS): string {
  return Math.max(0, Math.round(uiAmount * 10 ** decimals)).toString();
}

function fromBaseUnits(raw: string, decimals = USDC_DECIMALS): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return value / 10 ** decimals;
}

/** Wallet asset symbols beyond the three market assets (cbBTC/WBTC) map onto the BTC market. */
function marketAssetForSymbol(symbol: string | undefined): Market["assetSymbol"] | null {
  if (symbol === "SOL") return "SOL";
  if (symbol === "cbBTC" || symbol === "WBTC" || symbol === "BTC") return "BTC";
  if (symbol === "ETH") return "ETH";
  return null;
}

function daysUntil(expiryTs: number): number {
  const now = Date.now() / 1000;
  return Math.max(0, Math.round((expiryTs - now) / 86400));
}

// strike_price is stored at Pyth's own expo precision (1e8 per whole unit, per
// docs/libs/API.md), not USDC's 6 decimals — using the USDC default here was a 100x bug.
const PYTH_PRICE_DECIMALS = 8;

function formatStrike(strikePrice: string): string {
  return `$${formatUsd(fromBaseUnits(strikePrice, PYTH_PRICE_DECIMALS))}`;
}

export default function MarketPage() {
  return (
    <Suspense
      fallback={
        <AppShell lockViewport>
          <main className="mx-auto h-full w-full max-w-[1140px] px-4 xl:px-0" />
        </AppShell>
      }
    >
      <MarketPageContent />
    </Suspense>
  );
}

function MarketPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);
  const [confirmOpen, setConfirmOpen] = useState(
    () => searchParams.get("confirm") === "1",
  );
  const [quote, setQuote] = useState<ProtectQuote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const sendTx = useSendUnsignedTx();

  useEffect(() => {
    setConfirmOpen(searchParams.get("confirm") === "1");
  }, [searchParams]);

  const setTab = useCallback(
    (next: MarketTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "protect") {
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
    (next: ProtectQuote) => {
      setQuote(next);
      setSubmitError(null);
      const params = new URLSearchParams(searchParams.toString());
      params.set("confirm", "1");
      if (tab !== "protect") {
        params.set("tab", "protect");
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

  const { address } = useAppKitAccount();

  const handleConfirmProtect = useCallback(async () => {
    if (!quote || !address) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const owner = parseWalletAddress(address);
      const base64 = await buildProtectTx({
        market: quote.market,
        amount: quote.amountBaseUnits,
        minDownOut: quote.minDownOutBaseUnits,
        wallet: owner,
      });
      await sendTx(base64);
      closeConfirm();
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setSubmitting(false);
    }
  }, [address, closeConfirm, quote, sendTx]);

  const copy = PAGE_COPY;

  return (
    <AppShell lockViewport>
      <main className="mx-auto flex h-full min-h-0 w-full max-w-[1140px] flex-col gap-4 px-4 py-6 sm:gap-5 sm:py-8 xl:px-0 xl:py-16">
        <header className="flex w-full shrink-0 flex-col gap-2 sm:gap-3">
          <h1 className="m-0 max-w-[22ch] text-balance font-display text-[24px] font-bold leading-8 tracking-[-0.24px] text-neutrals-8 sm:text-[32px] sm:leading-10 sm:tracking-[-0.32px]">
            {copy.title}
          </h1>
          <p className="m-0 max-w-[65ch] text-pretty font-body text-caption-2 leading-5 text-neutrals-5">
            {copy.subtitle}
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

          {tab === "protect" ? <ProtectPanel onBuy={openConfirm} refreshKey={refreshKey} /> : null}
          {tab === "positions" ? (
            <PositionsPanel onProtect={() => setTab("protect")} refreshKey={refreshKey} onRedeemed={() => setRefreshKey((key) => key + 1)} />
          ) : null}
          {tab === "history" ? <HistoryPanel refreshKey={refreshKey} /> : null}
        </div>
      </main>

      <ConfirmTransactionModal
        open={confirmOpen}
        coverage={quote?.coverage ?? ""}
        youPay={quote?.youPay ?? ""}
        note={submitError ?? undefined}
        onCancel={closeConfirm}
        onConfirm={handleConfirmProtect}
      />
      {submitting ? (
        <p className="sr-only" role="status">
          Waiting for wallet confirmation…
        </p>
      ) : null}
    </AppShell>
  );
}

function ProtectPanel({
  onBuy,
  refreshKey,
}: {
  onBuy: (quote: ProtectQuote) => void;
  refreshKey: number;
}) {
  const { address } = useAppKitAccount();
  const { caipNetworkId } = useAppKitNetwork();
  const cluster = clusterFromNetwork(
    typeof caipNetworkId === "string" ? caipNetworkId : undefined,
  );
  const [assets, setAssets] = useState<WalletAsset[]>([]);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(NATIVE_SOL_MINT);
  const [amountInput, setAmountInput] = useState("1");

  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [expiryIndex, setExpiryIndex] = useState(0);
  const [pool, setPool] = useState<Pool | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    const owner = parseWalletAddress(address);
    let cancelled = false;
    setAssetsLoading(true);
    setAssetsError(null);
    fetchWalletAssets(owner, cluster)
      .then((payload) => {
        if (cancelled) return;
        setAssets(payload.assets);
        setUsdcBalance(payload.usdcBalance);
        setSelectedId((current) => {
          const stillThere = payload.assets.some(
            (item) => item.id === current && item.supported,
          );
          if (stillThere) return current;
          return payload.assets.find((item) => item.supported)?.id ?? NATIVE_SOL_MINT;
        });
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
  }, [address, cluster, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setMarketsLoading(true);
    setMarketsError(null);
    fetchMarkets({ status: "active" })
      .then((data) => {
        if (!cancelled) setMarkets(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMarketsError(error instanceof Error ? error.message : "Couldn't load markets.");
        }
      })
      .finally(() => {
        if (!cancelled) setMarketsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const asset = assets.find((item) => item.id === selectedId) ?? assets.find((item) => item.supported);
  const marketAsset = marketAssetForSymbol(asset?.symbol);
  const marketsForAsset = useMemo(
    () =>
      markets
        .filter((item) => item.assetSymbol === marketAsset)
        .sort((a, b) => a.expiryTs - b.expiryTs),
    [markets, marketAsset],
  );

  useEffect(() => {
    setExpiryIndex(0);
  }, [marketAsset]);

  const selectedMarket = marketsForAsset[expiryIndex] ?? marketsForAsset[0] ?? null;

  useEffect(() => {
    if (!selectedMarket) {
      setPool(null);
      return;
    }
    let cancelled = false;
    setPoolLoading(true);
    fetchPool(selectedMarket.address)
      .then((data) => {
        if (!cancelled) setPool(data);
      })
      .catch(() => {
        if (!cancelled) setPool(null);
      })
      .finally(() => {
        if (!cancelled) setPoolLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMarket]);

  const price = asset?.price ?? 0;
  const amount = parseAmount(amountInput);
  const maxAmount = maxAmountFor(price, usdcBalance);
  const coverageUsd = amount === null ? 0 : amount * price;
  const exceedsBalance = amount !== null && coverageUsd > usdcBalance + 0.0001;
  const canBuy =
    Boolean(asset?.supported) &&
    Boolean(selectedMarket) &&
    Boolean(pool) &&
    amount !== null &&
    amount > 0 &&
    price > 0 &&
    !exceedsBalance;
  const premium = coverageUsd;
  // Total DOWN held after mint+swap (for display) = the mint leg (coverageUsd, 1:1) plus the
  // swap leg's real output. The swap leg must use the AMM's actual LMSR price-impact curve
  // (lmsrSwapAmountOut), not a linear priceDown/priceUp ratio — that ratio only holds for an
  // infinitesimally small trade; anything sized relative to the pool's `b` gets materially
  // less out, and overestimating it here means minDownOut trips AMM's SlippageExceeded on
  // every real buy (found by testing against a live devnet pool, not a theoretical concern).
  const amountBaseUnits = toBaseUnits(coverageUsd);
  const swapGrossOut = pool
    ? lmsrSwapAmountOut(Number(pool.qDown), Number(pool.qUp), Number(pool.b), "up", Number(amountBaseUnits))
    : 0;
  const swapNetOutBaseUnits = pool ? applyLmsrFee(swapGrossOut, pool.feeBps) : 0;
  const swapDownOut = swapNetOutBaseUnits / 10 ** USDC_DECIMALS;
  const downOut = coverageUsd + swapDownOut;
  const expiryDays = selectedMarket ? daysUntil(selectedMarket.expiryTs) : 0;
  const expiryLabel = expiryDays <= 1 ? "1 day" : `${expiryDays} days`;

  function applyAsset(nextId: string) {
    const nextAsset = assets.find((item) => item.id === nextId);
    if (!nextAsset?.supported) return;
    const current = parseAmount(amountInput);
    const nextMax = maxAmountFor(nextAsset.price ?? 0, usdcBalance);
    if (current === null || current * (nextAsset.price ?? 0) > usdcBalance) {
      setAmountInput(String(nextMax));
    }
    setSelectedId(nextId);
  }

  function handleAmountChange(value: string) {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmountInput(value);
    }
  }

  const coverageLabel =
    amount !== null && amount > 0
      ? `${formatTokenAmount(amount)} ${asset?.symbol ?? ""}`.trim()
      : `0 ${asset?.symbol ?? ""}`.trim();

  const noMarketMessage = !marketsLoading && !selectedMarket
    ? `No active market for ${asset?.symbol ?? "this asset"} yet.`
    : null;

  return (
    <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-x-[49px] lg:gap-y-8">
      <div className="flex flex-col gap-5 lg:gap-[25px]">
        <div className="flex min-h-12 w-full items-center justify-between gap-3">
          <Select value={asset?.id ?? selectedId} onValueChange={applyAsset} disabled={assetsLoading}>
            <SelectTrigger
              aria-label="Select asset"
              className="group h-auto min-w-0 max-w-[217px] flex-1 gap-[10px] rounded-pill border-0 bg-neutrals-2 px-3 py-2 text-neutrals-8 transition-colors duration-200 hover:bg-neutrals-3 focus-visible:border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-1 sm:w-[217px] sm:flex-none sm:px-4"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                {assetsLoading ? (
                  <span className="size-6 shrink-0 animate-pulse rounded-full bg-neutrals-3" />
                ) : (
                  <TokenIcon src={asset?.iconUrl ?? null} symbol={asset?.symbol ?? "?"} />
                )}
                <span className="truncate font-body text-sm font-medium leading-6 text-neutrals-8">
                  {asset?.symbol ?? "SOL"}
                </span>
                <span className="hidden truncate font-body text-sm leading-6 text-neutrals-4 sm:inline">
                  {asset?.name ?? "Solana"}
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
              {assets.map((item) => (
                <SelectItem
                  key={item.id}
                  value={item.id}
                  disabled={!item.supported}
                  className="w-full text-neutrals-8 focus:bg-neutrals-3 data-[disabled]:opacity-60"
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <TokenIcon src={item.iconUrl} symbol={item.symbol} />
                      <span className="truncate font-body text-sm font-medium leading-6">
                        {item.symbol}
                      </span>
                      <span className="truncate font-body text-sm leading-6 text-neutrals-4">
                        {item.name}
                      </span>
                    </span>
                    <StatusPill variant={item.supported ? "success" : "muted"}>
                      {item.supported ? "Supported" : "Not supported"}
                    </StatusPill>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-col items-end justify-center font-body text-sm font-medium leading-6 tabular-nums">
            {assetsLoading ? (
              <>
                <span className="h-6 w-16 animate-pulse rounded bg-neutrals-3" />
                <span className="mt-0.5 h-6 w-[72px] animate-pulse rounded bg-neutrals-3" />
              </>
            ) : (
              <>
                <span className="text-neutrals-8">
                  {asset?.price != null ? `$${formatUsd(asset.price)}` : "-"}
                </span>
                {asset?.change24h != null ? (
                  <span className={asset.change24h >= 0 ? "text-primary-4" : "text-primary-3"}>
                    24h {asset.change24h >= 0 ? "+" : "-"}
                    {Math.abs(asset.change24h).toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-neutrals-4">24h -</span>
                )}
              </>
            )}
          </div>
        </div>
        {assetsError ? (
          <p className="m-0 w-full font-body text-caption-2 text-primary-3" role="alert">
            {assetsError}
          </p>
        ) : null}
        {marketsError ? (
          <p className="m-0 w-full font-body text-caption-2 text-primary-3" role="alert">
            {marketsError}
          </p>
        ) : null}
        {noMarketMessage ? (
          <p className="m-0 w-full font-body text-caption-2 text-neutrals-5">{noMarketMessage}</p>
        ) : null}

        <div
          className={cn(
            "flex w-full flex-col gap-4 rounded-[10px] border bg-neutrals-1 px-4 py-5 transition-colors duration-200 focus-within:border-primary-1 sm:px-[33px] sm:py-6",
            exceedsBalance ? "border-primary-3" : "border-neutrals-3",
          )}
        >
          <div className="flex min-h-12 w-full flex-col items-start gap-1 sm:h-12 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <label className="sr-only" htmlFor="coverage-amount">
              Coverage amount in {asset?.symbol ?? "SOL"}
            </label>
            <input
              id="coverage-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountInput}
              onChange={(event) => handleAmountChange(event.target.value)}
              className="min-w-0 w-full border-none bg-transparent p-0 font-display text-[32px] font-bold leading-10 tracking-[-0.32px] text-neutrals-8 caret-primary-1 tabular-nums outline-none placeholder:text-neutrals-4 sm:flex-1 sm:text-[40px] sm:leading-[48px] sm:tracking-[-0.4px]"
              placeholder="0"
            />
            <span className="shrink-0 font-body text-sm font-medium leading-6 text-neutrals-5 tabular-nums sm:text-base">
              ≈ ${formatUsd(coverageUsd)} protected
            </span>
          </div>
          <div className="flex w-full items-end justify-between gap-4 sm:items-center">
            <div className="font-body text-caption-2 tabular-nums">
              <p
                className={cn(
                  "m-0 leading-5",
                  exceedsBalance ? "text-primary-3" : "text-neutrals-4",
                )}
              >
                Collateral required: {formatUsd(coverageUsd)} USDC
              </p>
              <p className="m-0 leading-5 text-neutrals-4">
                Available balance: {formatUsd(usdcBalance)} USDC
              </p>
              {exceedsBalance ? (
                <p className="m-0 leading-5 text-primary-3" role="alert">
                  Amount exceeds available balance.
                </p>
              ) : null}
            </div>
            <UiButton
              type="button"
              variant="dark"
              size="small"
              onClick={() => setAmountInput(String(maxAmount))}
            >
              Max
            </UiButton>
          </div>
        </div>

        <div className="flex w-full flex-col justify-center gap-2.5 rounded-[10px] border border-neutrals-4 bg-neutrals-1 px-4 py-4 sm:px-6">
          <div className="flex h-[33px] w-full items-center justify-between font-body font-medium text-neutrals-8">
            <span className="text-base leading-6">Expiry</span>
            <span className="text-sm leading-6 tabular-nums">
              {selectedMarket ? expiryLabel : "-"}
            </span>
          </div>
          <Slider
            variant="coverage"
            className="h-3"
            min={0}
            max={Math.max(0, marketsForAsset.length - 1)}
            step={1}
            value={[expiryIndex]}
            aria-label="Expiry"
            onValueChange={([next]) => setExpiryIndex(next)}
          />
          <div className="flex h-[33px] w-full items-center justify-between font-body text-caption-2 text-neutrals-8">
            {marketsForAsset.map((market, index) => (
              <button
                key={market.address}
                type="button"
                className={cn(
                  "rounded-sm leading-5 transition-colors duration-200 hover:text-neutrals-8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-1",
                  index === expiryIndex ? "font-medium text-neutrals-8" : "text-neutrals-4",
                )}
                onClick={() => setExpiryIndex(index)}
              >
                {daysUntil(market.expiryTs)}d
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="flex h-auto min-h-0 flex-col gap-6 rounded-[10px] bg-neutrals-2 px-5 py-5 shadow-[inset_0_1px_0_rgba(252,252,253,0.06)] sm:px-8 sm:py-4 lg:h-full lg:gap-8">
        <div className="flex w-full flex-col gap-1">
          <p className="m-0 font-body text-body-2 text-neutrals-5">You pay</p>
          <p className="m-0 font-display text-[32px] font-bold leading-10 tracking-[-0.32px] text-neutrals-8 tabular-nums">
            ${formatUsd(premium)}
          </p>
          <p className="m-0 font-body text-body-2 text-neutrals-5">
            {selectedMarket ? `${expiryLabel} of coverage on ${coverageLabel}` : coverageLabel}
          </p>
        </div>
        <div className="h-px w-full bg-neutrals-3" />
        <DetailRows
          variant="flush"
          className="min-h-0 flex-1"
          rows={[
            {
              label: "Strike",
              value: selectedMarket ? formatStrike(selectedMarket.strikePrice) : "-",
            },
            { label: "Premium", value: `$${formatUsd(premium)}` },
            {
              label: "Max payout",
              value: `$${formatUsd(downOut)}`,
              valueClassName: "text-primary-4",
            },
            { label: "Resolves", value: "Pyth, block-final" },
          ]}
        />
        <UiButton
          type="button"
          variant="neutral"
          size="medium"
          className="mt-auto h-12 w-full whitespace-normal sm:whitespace-nowrap"
          disabled={!canBuy || poolLoading}
          onClick={() => {
            if (!selectedMarket || !pool) return;
            const minDownOutBaseUnits = Math.floor(
              (swapNetOutBaseUnits * (10_000 - PROTECT_SLIPPAGE_BPS)) / 10_000,
            ).toString();
            onBuy({
              coverage: coverageLabel,
              youPay: `${formatUsd(premium)} USDC`,
              market: selectedMarket.address,
              amountBaseUnits,
              minDownOutBaseUnits,
            });
          }}
        >
          {canBuy
            ? `Buy coverage for $${formatUsd(premium)} (${expiryLabel})`
            : asset && !asset.supported
              ? "This asset is not supported"
              : noMarketMessage
                ? "No market available"
                : "Enter a coverage amount"}
        </UiButton>
      </aside>
    </div>
  );
}

type PolicyTableRow = {
  key: string;
  symbol: string;
  name: string;
  iconUrl: string | null;
  strike: string;
  premium: string;
  status: string;
  statusVariant?: "success" | "muted";
  meta: string;
  extra?: ReactNode;
  metaClassName?: string;
};

function PolicyTable({
  rows,
  metaLabel,
  extraLabel,
  empty,
}: {
  rows: PolicyTableRow[];
  metaLabel: string;
  extraLabel?: string;
  empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className="min-h-0 w-full flex-1 overflow-x-auto lg:overflow-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead className="sticky top-0 bg-neutrals-1">
          <tr className="border-b border-neutrals-3">
            <th className="px-4 py-3 font-body text-caption-2 font-medium text-neutrals-4">Asset</th>
            <th className="px-4 py-3 font-body text-caption-2 font-medium text-neutrals-4">Strike</th>
            <th className="px-4 py-3 font-body text-caption-2 font-medium text-neutrals-4">Premium</th>
            <th className="px-4 py-3 font-body text-caption-2 font-medium text-neutrals-4">Status</th>
            <th className="px-4 py-3 font-body text-caption-2 font-medium text-neutrals-4">{metaLabel}</th>
            {extraLabel ? (
              <th className="px-4 py-3 text-right font-body text-caption-2 font-medium text-neutrals-4">
                {extraLabel}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-neutrals-3 last:border-b-0">
              <td className="px-4 py-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <TokenIcon src={row.iconUrl} symbol={row.symbol} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-body text-sm font-medium leading-6 text-neutrals-8">
                      {row.symbol}
                    </span>
                    <span className="truncate font-body text-caption-2 text-neutrals-4">
                      {row.name}
                    </span>
                  </span>
                </span>
              </td>
              <td className="px-4 py-3 font-body text-sm leading-6 text-neutrals-8 tabular-nums">
                {row.strike}
              </td>
              <td className="px-4 py-3 font-body text-sm leading-6 text-neutrals-8 tabular-nums">
                {row.premium}
              </td>
              <td className="px-4 py-3">
                <StatusPill variant={row.statusVariant ?? "success"}>{row.status}</StatusPill>
              </td>
              <td
                className={cn(
                  "px-4 py-3 font-body text-sm leading-6 tabular-nums text-neutrals-8",
                  row.metaClassName,
                )}
              >
                {row.meta}
              </td>
              {extraLabel ? (
                <td className="px-4 py-3 text-right font-body text-sm leading-6 tabular-nums text-neutrals-4">
                  {row.extra}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function iconFor(symbol: string): string | null {
  if (symbol === "SOL") return SOL.iconUrl;
  if (symbol === "BTC") return CBBTC.iconUrl;
  if (symbol === "ETH") return null;
  return WBTC.iconUrl;
}

function nameFor(symbol: string): string {
  if (symbol === "SOL") return "Solana";
  if (symbol === "BTC") return "Bitcoin";
  if (symbol === "ETH") return "Ethereum";
  return symbol;
}

function usePositionsWithMarkets(refreshKey: number) {
  const { address } = useAppKitAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setPositions([]);
      setLoading(false);
      return;
    }
    const owner = parseWalletAddress(address);
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchPositions(owner), fetchMarkets()])
      .then(([positionsData, marketsData]) => {
        if (cancelled) return;
        setPositions(positionsData);
        setMarkets(marketsData);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load positions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  const marketByAddress = useMemo(() => {
    const map = new Map<string, Market>();
    markets.forEach((market) => map.set(market.address, market));
    return map;
  }, [markets]);

  return { positions, marketByAddress, loading, error, connected: Boolean(address) };
}

function PositionsPanel({
  onProtect,
  refreshKey,
  onRedeemed,
}: {
  onProtect: () => void;
  refreshKey: number;
  onRedeemed: () => void;
}) {
  const [token, setToken] = useState("all");
  const { positions, marketByAddress, loading, error, connected } = usePositionsWithMarkets(refreshKey);
  const { address } = useAppKitAccount();
  const sendTx = useSendUnsignedTx();
  const [redeemingMarket, setRedeemingMarket] = useState<string | null>(null);

  const active = positions.filter(
    (position) => Number(position.downBalance) > 0 && position.marketStatus !== "resolved",
  );
  const rows = active.filter((row) => token === "all" || row.assetSymbol === token);

  async function handleRedeem(position: Position) {
    if (!address) return;
    const winningBalance = position.marketOutcome === "up" ? position.upBalance : position.downBalance;
    if (!(Number(winningBalance) > 0)) return;
    setRedeemingMarket(position.market);
    try {
      const owner = parseWalletAddress(address);
      const base64 = await buildRedeemTx({
        market: position.market,
        amount: winningBalance,
        wallet: owner,
      });
      await sendTx(base64);
      onRedeemed();
    } catch {
      // surfaced implicitly via unchanged balances; the row stays actionable to retry
    } finally {
      setRedeemingMarket(null);
    }
  }

  const tableRows: PolicyTableRow[] = rows.map((position) => {
    const market = marketByAddress.get(position.market);
    return {
      key: position.market,
      symbol: position.assetSymbol,
      name: nameFor(position.assetSymbol),
      iconUrl: iconFor(position.assetSymbol),
      strike: market ? formatStrike(market.strikePrice) : "-",
      premium: `${formatUsd(fromBaseUnits(position.downBalance))} DOWN`,
      status: "Active",
      statusVariant: "success",
      meta: market ? `${daysUntil(market.expiryTs)}d` : "-",
    };
  });

  if (!connected) {
    return (
      <div className="flex w-full flex-col items-start gap-2 rounded-[10px] bg-neutrals-2 px-6 py-8">
        <p className="m-0 font-body text-sm font-medium leading-6 text-neutrals-8">
          Connect a wallet to view your positions
        </p>
      </div>
    );
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
      {error ? (
        <p className="m-0 font-body text-caption-2 text-primary-3" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <div className="h-24 w-full animate-pulse rounded-[10px] bg-neutrals-2" />
      ) : (
        <PolicyTable
          rows={tableRows}
          metaLabel="Expires"
          empty={
            <div className="flex w-full flex-col items-start gap-2 rounded-[10px] bg-neutrals-2 px-6 py-8">
              <p className="m-0 font-body text-sm font-medium leading-6 text-neutrals-8">
                No policies match this filter
              </p>
              <p className="m-0 max-w-[42ch] font-body text-caption-2 text-neutrals-4">
                Choose another token, or open Protect to buy coverage.
              </p>
              <button
                type="button"
                className="mt-1 font-display text-sm font-bold leading-4 text-neutrals-8 transition-colors duration-200 hover:text-neutrals-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-1"
                onClick={onProtect}
              >
                Open Protect
              </button>
            </div>
          }
        />
      )}
      {rows
        .filter((position) => position.marketStatus === "resolved")
        .map((position) => (
          <UiButton
            key={`redeem-${position.market}`}
            type="button"
            variant="dark"
            size="small"
            disabled={redeemingMarket === position.market}
            onClick={() => handleRedeem(position)}
          >
            {redeemingMarket === position.market ? "Redeeming…" : `Redeem ${position.assetSymbol}`}
          </UiButton>
        ))}
    </div>
  );
}

function HistoryPanel({ refreshKey }: { refreshKey: number }) {
  const [outcome, setOutcome] = useState("all");
  const [token, setToken] = useState("all");
  const { positions, marketByAddress, loading, error, connected } = usePositionsWithMarkets(refreshKey);

  const resolved = positions.filter((position) => position.marketStatus === "resolved");

  const withOutcome = resolved.map((position) => {
    const paid = position.marketOutcome === "down";
    return {
      position,
      outcome: paid ? ("paid" as const) : ("expired" as const),
    };
  });

  const rows = withOutcome.filter(({ position, outcome: rowOutcome }) => {
    if (outcome !== "all" && rowOutcome !== outcome) return false;
    if (token !== "all" && position.assetSymbol !== token) return false;
    return true;
  });

  const tableRows: PolicyTableRow[] = rows.map(({ position, outcome: rowOutcome }) => {
    const market = marketByAddress.get(position.market);
    const paidAmount =
      rowOutcome === "paid" ? fromBaseUnits(position.downBalance) : 0;
    return {
      key: position.market,
      symbol: position.assetSymbol,
      name: nameFor(position.assetSymbol),
      iconUrl: iconFor(position.assetSymbol),
      strike: market ? formatStrike(market.strikePrice) : "-",
      premium: "-",
      status: rowOutcome === "paid" ? "Paid out" : "No payout",
      statusVariant: rowOutcome === "paid" ? "success" : "muted",
      meta: rowOutcome === "paid" ? `+$${formatUsd(paidAmount)}` : "Expired",
      metaClassName: rowOutcome === "paid" ? "text-primary-4" : undefined,
      extra: market?.resolvedAt
        ? new Date(market.resolvedAt * 1000).toLocaleDateString()
        : "-",
    };
  });

  if (!connected) {
    return (
      <div className="flex w-full flex-col items-start gap-2 rounded-[10px] bg-neutrals-2 px-6 py-8">
        <p className="m-0 font-body text-sm font-medium leading-6 text-neutrals-8">
          Connect a wallet to view your history
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 lg:overflow-hidden">
      <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row">
        <FilterDropdown
          label="Outcome"
          aria-label="Filter by outcome"
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: "all", label: "All outcomes" },
            { value: "paid", label: "Paid out" },
            { value: "expired", label: "No payout" },
          ]}
        />
        <FilterDropdown
          label="Token"
          aria-label="Filter by token"
          value={token}
          onChange={setToken}
          options={TOKEN_FILTER_OPTIONS}
        />
      </div>
      {error ? (
        <p className="m-0 font-body text-caption-2 text-primary-3" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <div className="h-24 w-full animate-pulse rounded-[10px] bg-neutrals-2" />
      ) : (
        <PolicyTable
          rows={tableRows}
          metaLabel="Payout"
          extraLabel="Settled"
          empty={
            <div className="flex w-full flex-col items-start gap-2 rounded-[10px] bg-neutrals-2 px-6 py-8">
              <p className="m-0 font-body text-sm font-medium leading-6 text-neutrals-8">
                No history matches these filters
              </p>
              <p className="m-0 max-w-[42ch] font-body text-caption-2 text-neutrals-4">
                Expired policies appear here after settlement.
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
