"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppKit, useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { Button } from "@/components/atoms/button";
import { TokenLogo } from "@/components/atoms/token-logo";
import { ConfirmTransactionModal } from "@/components/organisms/confirm-transaction-modal";
import {
  NATIVE_SOL_MINT,
  PROTECT_SLIPPAGE_BPS,
  USDC_DECIMALS,
  clusterFromNetwork,
  expiryLabel,
  formatStrike,
  formatTokenAmount,
  formatUsd,
  fromBaseUnits,
  marketAssetForSymbol,
  maxAmountFor,
  parseAmount,
  PYTH_PRICE_DECIMALS,
  toBaseUnits,
  tokenLogoSymbol,
  usd,
} from "@/lib/app-format";
import { fetchMarkets, type Market } from "@/lib/api/markets";
import { fetchPool, type Pool } from "@/lib/api/pool";
import { buildProtectTx } from "@/lib/api/tx";
import { applyLmsrFee, lmsrSwapAmountOut } from "@/lib/lmsr";
import { cn } from "@/lib/utils";
import { fetchWalletAssets, parseWalletAddress, type WalletAsset } from "@/lib/wallet/assets";
import { useSendUnsignedTx } from "@/lib/wallet/send-transaction";

export function ProtectFlow() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { caipNetworkId } = useAppKitNetwork();
  const cluster = clusterFromNetwork(typeof caipNetworkId === "string" ? caipNetworkId : undefined);
  const sendTx = useSendUnsignedTx();

  const [assets, setAssets] = useState<WalletAsset[]>([]);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(NATIVE_SOL_MINT);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [amountInput, setAmountInput] = useState("1");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [expiryIndex, setExpiryIndex] = useState(0);
  const [pool, setPool] = useState<Pool | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!address) {
      setAssets([]);
      setUsdcBalance(0);
      return;
    }
    const owner = parseWalletAddress(address);
    let cancelled = false;
    setAssetsError(null);
    fetchWalletAssets(owner, cluster)
      .then((payload) => {
        if (cancelled) return;
        setAssets(payload.assets);
        setUsdcBalance(payload.usdcBalance);
        setSelectedId((current) => {
          const stillThere = payload.assets.some((item) => item.id === current && item.supported);
          if (stillThere) return current;
          return payload.assets.find((item) => item.supported)?.id ?? NATIVE_SOL_MINT;
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAssetsError(error instanceof Error ? error.message : "Couldn't load wallet assets.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address, cluster, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setMarketsError(null);
    fetchMarkets({ status: "active" })
      .then((data) => {
        if (!cancelled) setMarkets(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMarketsError(error instanceof Error ? error.message : "Couldn't load markets.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const supportedAssets = assets.filter((item) => item.supported);
  const asset = assets.find((item) => item.id === selectedId) ?? supportedAssets[0];
  const marketAsset = marketAssetForSymbol(asset?.symbol) ?? "SOL";
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

  const strikeUsd = selectedMarket ? fromBaseUnits(selectedMarket.strikePrice, PYTH_PRICE_DECIMALS) : 0;
  const price = asset?.price || strikeUsd;
  const amount = parseAmount(amountInput);
  const maxAmount = maxAmountFor(price, usdcBalance);
  const coverageUsd = amount === null ? 0 : amount * price;
  const exceedsBalance = isConnected && amount !== null && coverageUsd > usdcBalance + 0.0001;
  const canBuy =
    isConnected &&
    Boolean(asset?.supported) &&
    Boolean(selectedMarket) &&
    Boolean(pool) &&
    amount !== null &&
    amount > 0 &&
    price > 0 &&
    !exceedsBalance;
  const amountBaseUnits = toBaseUnits(coverageUsd);
  const swapGrossOut = pool
    ? lmsrSwapAmountOut(Number(pool.qDown), Number(pool.qUp), Number(pool.b), "up", Number(amountBaseUnits))
    : 0;
  const swapNetOutBaseUnits = pool ? applyLmsrFee(swapGrossOut, pool.feeBps) : 0;
  const downOut = coverageUsd + swapNetOutBaseUnits / 10 ** USDC_DECIMALS;
  const coverageLabel =
    amount !== null && amount > 0
      ? `${formatTokenAmount(amount)} ${asset?.symbol ?? marketAsset}`
      : `0 ${asset?.symbol ?? marketAsset}`;
  const expiry = selectedMarket ? expiryLabel(selectedMarket.expiryTs) : "-";
  const symbol = asset?.symbol ?? "SOL";

  async function handleConfirm() {
    if (!selectedMarket || !pool || !address) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const minDownOutBaseUnits = Math.floor(
        (swapNetOutBaseUnits * (10_000 - PROTECT_SLIPPAGE_BPS)) / 10_000,
      ).toString();
      const base64 = await buildProtectTx({
        market: selectedMarket.address,
        amount: amountBaseUnits,
        minDownOut: minDownOutBaseUnits,
        wallet: parseWalletAddress(address),
      });
      await sendTx(base64);
      setConfirmOpen(false);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Transaction failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex w-full flex-col gap-[31px] lg:flex-row lg:items-center">
        <section className="flex min-w-0 flex-1 flex-col gap-xl overflow-clip rounded-md border border-neutral-700 bg-surface-900/30 p-xl">
          <div className="flex h-[60px] items-center justify-between overflow-clip">
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-lg overflow-clip rounded-sm bg-surface-800 px-md py-sm"
                onClick={() => setPickerOpen((openPicker) => !openPicker)}
              >
                <TokenLogo symbol={tokenLogoSymbol(symbol)} />
                <span className="text-body-md font-semibold text-white">{symbol}</span>
              </button>
              {pickerOpen && supportedAssets.length > 0 ? (
                <div className="absolute left-0 top-full z-10 mt-sm flex min-w-full flex-col overflow-clip rounded-sm border border-neutral-700 bg-surface-800">
                  {supportedAssets.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex items-center gap-md px-md py-sm text-left text-body-sm text-white hover:bg-surface-900"
                      onClick={() => {
                        setSelectedId(item.id);
                        setPickerOpen(false);
                      }}
                    >
                      <TokenLogo symbol={tokenLogoSymbol(item.symbol)} />
                      {item.symbol}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-sm overflow-clip">
              <span className="text-h6 text-white">{price > 0 ? usd(price) : "-"}</span>
              {asset?.change24h != null ? (
                <span className={asset.change24h >= 0 ? "text-body-lg font-semibold text-success-500" : "text-body-lg font-semibold text-soft-400"}>
                  {asset.change24h >= 0 ? "+" : ""}
                  {asset.change24h.toFixed(1)}% 24h
                </span>
              ) : (
                <span className="text-body-lg font-semibold text-soft-400">24h -</span>
              )}
            </div>
          </div>
          <div className="flex h-14 items-center justify-between gap-lg overflow-clip">
            <input
              aria-label="Coverage amount"
              inputMode="decimal"
              value={amountInput}
              onChange={(event) => {
                const next = event.target.value.replace(/,/g, "");
                if (next === "" || /^\d*\.?\d{0,8}$/.test(next)) setAmountInput(next);
              }}
              className="h-14 min-w-0 flex-1 bg-transparent text-h3 text-white outline-none placeholder:text-soft-400"
              placeholder="0.00"
            />
            <span className="shrink-0 text-h6 font-semibold text-soft-300">{symbol}</span>
          </div>
          <div className="flex items-center justify-between gap-lg">
            <p className={cn("text-body-sm", exceedsBalance ? "text-primary-400" : "text-soft-300")}>
              Available balance: {formatUsd(usdcBalance)} USDC
              {exceedsBalance ? " — exceeds balance" : ""}
            </p>
            <button
              type="button"
              onClick={() => setAmountInput(String(maxAmount))}
              className="rounded-sm bg-surface-800 px-md py-sm text-body-sm font-medium text-white"
            >
              Max
            </button>
          </div>
          {assetsError || marketsError ? (
            <p className="m-0 text-body-sm text-primary-400" role="alert">
              {assetsError ?? marketsError}
            </p>
          ) : null}
          <div className="flex flex-col gap-md overflow-clip">
            <p className="text-body-md text-white">Expiry</p>
            <div className="flex flex-wrap gap-sm overflow-clip">
              {marketsForAsset.length === 0 ? (
                <span className="text-body-sm text-soft-300">No active market</span>
              ) : (
                marketsForAsset.map((market, index) => (
                  <button
                    key={market.address}
                    type="button"
                    onClick={() => setExpiryIndex(index)}
                    className={cn(
                      "rounded-sm px-lg py-sm text-body-sm text-white",
                      index === expiryIndex ? "bg-primary-500" : "bg-surface-800",
                    )}
                  >
                    {expiryLabel(market.expiryTs)}
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="flex h-8 items-center justify-between overflow-clip">
            <span className="text-body-md text-soft-300">You pay</span>
            <span className="text-h6 text-white">{usd(coverageUsd)}</span>
          </div>
        </section>
        <aside className="flex h-auto w-full flex-col gap-xl overflow-clip rounded-md border border-neutral-700 bg-neutral-700/30 p-xl lg:h-[398px] lg:w-[353px] lg:shrink-0">
          <h2 className="text-h6 text-white">Coverage quote</h2>
          <div className="flex min-h-0 flex-1 flex-col gap-lg overflow-clip">
            {[
              ["Strike", selectedMarket ? formatStrike(selectedMarket.strikePrice) : "-"],
              ["Premium", usd(coverageUsd)],
              ["Max payout", usd(downOut)],
              ["Resolves", "Pyth, block-final"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between overflow-clip">
                <span className="text-body-sm text-soft-300">{label}</span>
                <span className="text-body-md font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
          <Button
            variant="primary"
            size="md"
            className="w-full"
            disabled={isConnected ? !canBuy || poolLoading : false}
            onClick={() => {
              if (!isConnected) {
                open({ view: "Connect" });
                return;
              }
              setSubmitError(null);
              setConfirmOpen(true);
            }}
          >
            {!isConnected
              ? "Connect wallet to buy"
              : canBuy
                ? `Buy coverage for ${usd(coverageUsd)} (${expiry})`
                : exceedsBalance
                  ? "Amount exceeds available balance"
                  : selectedMarket
                    ? "Enter a coverage amount"
                    : "No market available"}
          </Button>
        </aside>
      </div>
      <ConfirmTransactionModal
        open={confirmOpen}
        title="Confirm coverage"
        busy={submitting}
        error={submitError}
        rows={[
          { label: "Action", value: "Buy coverage" },
          { label: "Coverage", value: coverageLabel },
          { label: "Strike", value: selectedMarket ? formatStrike(selectedMarket.strikePrice) : "-" },
          { label: "Expiry", value: expiry },
          { label: "You pay", value: usd(coverageUsd), accent: true },
          { label: "Network fee", value: "~0.00025 SOL" },
        ]}
        note="Your premium buys coverage in a single transaction. The full payout is locked in an on-chain vault for the life of the policy, and settles automatically at expiry. There is no claim to file."
        onCancel={() => {
          if (!submitting) setConfirmOpen(false);
        }}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
