"use client";

import { useEffect, useState } from "react";
import { useAppKit, useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { Button } from "@/components/atoms/button";
import { TokenLogo } from "@/components/atoms/token-logo";
import { ConfirmTransactionModal } from "@/components/organisms/confirm-transaction-modal";
import {
  clusterFromNetwork,
  expiryLabel,
  formatTokenAmount,
  formatUsd,
  fromBaseUnits,
  nameFor,
  parseAmount,
  toBaseUnits,
  tokenLogoSymbol,
  usd,
} from "@/lib/app-format";
import { fetchMarkets, type Market } from "@/lib/api/markets";
import { fetchPool, type Pool } from "@/lib/api/pool";
import { fetchPositions, type Position } from "@/lib/api/positions";
import { buildAddLiquidityTx, buildRemoveLiquidityTx } from "@/lib/api/tx";
import { cn } from "@/lib/utils";
import { fetchWalletAssets, parseWalletAddress } from "@/lib/wallet/assets";
import { useSendUnsignedTx } from "@/lib/wallet/send-transaction";

type MarketPool = { market: Market; pool: Pool };
type ConfirmKind = "add" | "remove";

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

export function LiquidityPoolFlow() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { caipNetworkId } = useAppKitNetwork();
  const cluster = clusterFromNetwork(typeof caipNetworkId === "string" ? caipNetworkId : undefined);
  const sendTx = useSendUnsignedTx();

  const [pools, setPools] = useState<MarketPool[]>([]);
  const [poolsError, setPoolsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("500");
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [lpPositions, setLpPositions] = useState<Position[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const [removing, setRemoving] = useState<Position | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPoolsError(null);
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
        if (cancelled) return;
        const next = settled.filter((item): item is MarketPool => item !== null);
        setPools(next);
        setSelectedId((current) => current || next[0]?.market.address || "");
      })
      .catch((err: unknown) => {
        if (!cancelled) setPoolsError(err instanceof Error ? err.message : "Couldn't load pools.");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!address) {
      setUsdcBalance(0);
      setLpPositions([]);
      return;
    }
    const owner = parseWalletAddress(address);
    let cancelled = false;
    fetchWalletAssets(owner, cluster)
      .then((payload) => {
        if (!cancelled) setUsdcBalance(payload.usdcBalance);
      })
      .catch(() => {
        if (!cancelled) setUsdcBalance(0);
      });
    fetchPositions(owner)
      .then((data) => {
        if (!cancelled) setLpPositions(data.filter((position) => Number(position.lpBalance) > 0));
      })
      .catch(() => {
        if (!cancelled) setLpPositions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [address, cluster, refreshKey]);

  const entry = pools.find((item) => item.market.address === selectedId) ?? pools[0] ?? null;
  const amount = parseAmount(amountInput);
  const exceedsBalance = isConnected && amount !== null && amount > usdcBalance + 0.0001;
  const canAdd =
    isConnected && Boolean(entry) && amount !== null && amount > 0 && !exceedsBalance;
  const tvl = entry ? tvlOf(entry.pool) : 0;
  const utilization = entry ? utilizationOf(entry.pool) : 0;
  const feePercent = entry ? entry.pool.feeBps / 100 : 0;
  const symbol = entry?.market.assetSymbol ?? "SOL";

  async function handleAdd() {
    if (!entry || !address || amount === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const base64 = await buildAddLiquidityTx({
        market: entry.market.address,
        usdcAmount: toBaseUnits(amount),
        wallet: parseWalletAddress(address),
      });
      await sendTx(base64);
      setConfirm(null);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Transaction failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!removing || !address) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const base64 = await buildRemoveLiquidityTx({
        market: removing.market,
        lpAmount: removing.lpBalance,
        wallet: parseWalletAddress(address),
      });
      await sendTx(base64);
      setConfirm(null);
      setRemoving(null);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Transaction failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const removePool = removing ? pools.find((item) => item.market.address === removing.market) : null;
  const removeLp = removing ? fromBaseUnits(removing.lpBalance) : 0;
  const removeShare =
    removePool && Number(removePool.pool.lpSupply) > 0
      ? removeLp / fromBaseUnits(removePool.pool.lpSupply)
      : 0;
  const removeUsd = removePool ? removeShare * tvlOf(removePool.pool) : 0;

  return (
    <>
      <div className="flex w-full flex-col gap-[31px] lg:h-[454px] lg:flex-row lg:items-stretch">
        <section className="flex min-w-0 flex-1 flex-col justify-between overflow-clip rounded-md border border-neutral-700 bg-surface-900/30 p-xl">
          <div className="flex h-[60px] items-center justify-between">
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-lg rounded-sm bg-surface-800 px-md py-sm"
                onClick={() => setPickerOpen((openPicker) => !openPicker)}
              >
                <TokenLogo symbol={tokenLogoSymbol(symbol)} />
                <span className="text-body-md font-semibold text-white">{symbol}</span>
              </button>
              {pickerOpen && pools.length > 0 ? (
                <div className="absolute left-0 top-full z-10 mt-sm flex min-w-[180px] flex-col overflow-clip rounded-sm border border-neutral-700 bg-surface-800">
                  {pools.map((item) => (
                    <button
                      key={item.market.address}
                      type="button"
                      className="flex items-center gap-md px-md py-sm text-left text-body-sm text-white hover:bg-surface-900"
                      onClick={() => {
                        setSelectedId(item.market.address);
                        setPickerOpen(false);
                      }}
                    >
                      <TokenLogo symbol={tokenLogoSymbol(item.market.assetSymbol)} />
                      {item.market.assetSymbol} · {expiryLabel(item.market.expiryTs)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-sm">
              <span className="text-body-md font-semibold text-white">{usd(tvl, 0)}</span>
              <span className="text-body-sm text-success-500">{feePercent.toFixed(2)}% fee</span>
            </div>
          </div>
          <div className="flex h-14 items-center justify-between">
            <input
              aria-label="Deposit amount"
              inputMode="decimal"
              value={amountInput}
              onChange={(event) => {
                const next = event.target.value.replace(/,/g, "");
                if (next === "" || /^\d*\.?\d{0,8}$/.test(next)) setAmountInput(next);
              }}
              className="h-14 min-w-0 flex-1 bg-transparent text-h3 text-white outline-none placeholder:text-soft-400"
              placeholder="0.00"
            />
            <span className="text-body-md font-semibold text-soft-300">USDC</span>
          </div>
          <div className="flex items-center justify-between gap-lg">
            <p className={cn("text-body-sm", exceedsBalance ? "text-primary-400" : "text-soft-300")}>
              Available balance: {formatUsd(usdcBalance)} USDC
              {exceedsBalance ? " — exceeds balance" : ""}
            </p>
            <button
              type="button"
              onClick={() => setAmountInput(String(Math.floor(usdcBalance * 100) / 100))}
              className="rounded-sm bg-surface-800 px-md py-sm text-body-sm font-medium text-white"
            >
              Max
            </button>
          </div>
          {poolsError ? (
            <p className="m-0 text-body-sm text-primary-400" role="alert">
              {poolsError}
            </p>
          ) : null}
          <div className="flex flex-col gap-md">
            <p className="text-body-md text-white">Pool utilization</p>
            <div className="flex items-center gap-md">
              <div className="h-2 min-w-px flex-1 overflow-clip rounded-sm bg-surface-800">
                <div className="h-2 rounded-sm bg-primary-500" style={{ width: `${utilization}%` }} />
              </div>
              <span className="text-body-sm font-medium text-white">{utilization}%</span>
            </div>
          </div>
          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={isConnected ? !canAdd : false}
            onClick={() => {
              if (!isConnected) {
                open({ view: "Connect" });
                return;
              }
              setSubmitError(null);
              setConfirm("add");
            }}
          >
            {!isConnected
              ? "Connect wallet to add liquidity"
              : canAdd
                ? `Add liquidity for ${usd(amount ?? 0)}`
                : exceedsBalance
                  ? "Amount exceeds available balance"
                  : "Enter a deposit amount"}
          </Button>
        </section>
        <aside className="flex w-full flex-col gap-xl overflow-clip rounded-md border border-neutral-700 bg-neutral-700/30 p-xl lg:w-[565px] lg:shrink-0">
          <h2 className="text-h6 text-white">Your positions</h2>
          <div className="w-full overflow-x-auto overflow-clip rounded-sm border border-neutral-700 bg-surface-800">
            <table className="w-full min-w-[480px] border-collapse text-left">
              <thead>
                <tr className="text-body-sm font-medium text-soft-400">
                  <th className="p-md font-medium">Asset</th>
                  <th className="w-24 p-md font-medium">LP</th>
                  <th className="w-[72px] p-md font-medium">Share</th>
                  <th className="w-[108px] p-md font-medium" />
                </tr>
              </thead>
              <tbody>
                {!isConnected ? (
                  <tr>
                    <td colSpan={4} className="p-md text-body-sm text-soft-300">
                      Connect a wallet to see LP positions
                    </td>
                  </tr>
                ) : lpPositions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-md text-body-sm text-soft-300">
                      No liquidity positions yet
                    </td>
                  </tr>
                ) : (
                  lpPositions.map((row) => {
                    const poolEntry = pools.find((item) => item.market.address === row.market);
                    const lp = fromBaseUnits(row.lpBalance);
                    const supply = poolEntry ? fromBaseUnits(poolEntry.pool.lpSupply) : 0;
                    const share = supply > 0 ? (lp / supply) * 100 : 0;
                    return (
                      <tr key={row.market} className="border-t border-neutral-700">
                        <td className="p-md">
                          <div className="flex items-center gap-sm">
                            <TokenLogo symbol={tokenLogoSymbol(row.assetSymbol)} />
                            <div className="flex flex-col text-body-sm">
                              <span className="font-medium text-white">{row.assetSymbol}</span>
                              <span className="text-soft-300">{nameFor(row.assetSymbol)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-md text-body-sm font-medium text-white">{formatTokenAmount(lp)}</td>
                        <td className="p-md text-body-sm font-medium text-white">{share.toFixed(2)}%</td>
                        <td className="p-md">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setRemoving(row);
                              setSubmitError(null);
                              setConfirm("remove");
                            }}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </aside>
      </div>
      <ConfirmTransactionModal
        open={confirm === "add"}
        title="Confirm add liquidity"
        busy={submitting}
        error={submitError}
        rows={[
          { label: "Action", value: "Add liquidity" },
          { label: "Pool", value: `${symbol} · ${nameFor(symbol)}` },
          { label: "Deposit", value: `${usd(amount ?? 0)} USDC`, accent: true },
          { label: "LP tokens", value: `${formatTokenAmount(amount ?? 0)} LP` },
          { label: "Network fee", value: "~0.00025 SOL" },
        ]}
        note="USDC is deposited into the AMM pool. You can withdraw before expiry, subject to available liquidity."
        onCancel={() => {
          if (!submitting) setConfirm(null);
        }}
        onConfirm={() => void handleAdd()}
      />
      <ConfirmTransactionModal
        open={confirm === "remove"}
        title="Confirm remove liquidity"
        busy={submitting}
        error={submitError}
        rows={[
          { label: "Action", value: "Remove liquidity" },
          {
            label: "Pool",
            value: removing ? `${removing.assetSymbol} · ${nameFor(removing.assetSymbol)}` : "-",
          },
          { label: "LP tokens", value: `${formatTokenAmount(removeLp)} LP` },
          { label: "You'll receive", value: `${usd(removeUsd)} USDC`, accent: true },
          { label: "Network fee", value: "~0.00025 SOL" },
        ]}
        note="LP tokens are burned and USDC returns to your wallet, including your share of earned fees."
        onCancel={() => {
          if (!submitting) {
            setConfirm(null);
            setRemoving(null);
          }
        }}
        onConfirm={() => void handleRemove()}
      />
    </>
  );
}
