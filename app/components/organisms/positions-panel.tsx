"use client";

import { useState } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { Button } from "@/components/atoms/button";
import { TokenLogo } from "@/components/atoms/token-logo";
import {
  daysUntil,
  formatStrike,
  fromBaseUnits,
  nameFor,
  tokenLogoSymbol,
  usd,
} from "@/lib/app-format";
import type { Position } from "@/lib/api/positions";
import { buildRedeemTx } from "@/lib/api/tx";
import { parseWalletAddress } from "@/lib/wallet/assets";
import { useSendUnsignedTx } from "@/lib/wallet/send-transaction";
import { usePositionsWithMarkets } from "@/lib/wallet/use-positions";

const TOKEN_FILTERS = ["all", "SOL", "BTC", "ETH"] as const;

export function PositionsPanel() {
  const { open } = useAppKit();
  const { address } = useAppKitAccount();
  const sendTx = useSendUnsignedTx();
  const [token, setToken] = useState<(typeof TOKEN_FILTERS)[number]>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const { positions, marketByAddress, loading, error, connected } = usePositionsWithMarkets(refreshKey);
  const [redeemingMarket, setRedeemingMarket] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const active = positions.filter(
    (position) => Number(position.downBalance) > 0 && position.marketStatus !== "resolved",
  );
  const rows = active.filter((row) => token === "all" || row.assetSymbol === token);
  const redeemable = positions.filter((position) => {
    if (position.marketStatus !== "resolved") return false;
    const winningBalance = position.marketOutcome === "up" ? position.upBalance : position.downBalance;
    return Number(winningBalance) > 0;
  });

  async function handleRedeem(position: Position) {
    if (!address) return;
    const winningBalance = position.marketOutcome === "up" ? position.upBalance : position.downBalance;
    if (!(Number(winningBalance) > 0)) return;
    setRedeemingMarket(position.market);
    setRedeemError(null);
    try {
      const base64 = await buildRedeemTx({
        market: position.market,
        amount: winningBalance,
        wallet: parseWalletAddress(address),
      });
      await sendTx(base64);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "Redeem failed. Try again.");
    } finally {
      setRedeemingMarket(null);
    }
  }

  if (!connected) {
    return (
      <div className="flex w-full flex-col items-start gap-md rounded-md border border-neutral-700 bg-surface-900/30 p-xl">
        <p className="m-0 text-body-md text-white">Connect a wallet to view your positions</p>
        <Button variant="primary" size="sm" onClick={() => open({ view: "Connect" })}>
          Connect Wallet
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-xl">
      <div className="flex items-center">
        <button
          type="button"
          className="flex items-center gap-md rounded-sm border border-neutral-700 bg-surface-900 px-lg py-sm text-body-sm"
          onClick={() => {
            const index = TOKEN_FILTERS.indexOf(token);
            setToken(TOKEN_FILTERS[(index + 1) % TOKEN_FILTERS.length]);
          }}
        >
          <span className="text-soft-300">Token</span>
          <span className="font-medium text-white">{token === "all" ? "All" : token}</span>
        </button>
      </div>
      {error ? (
        <p className="m-0 text-body-sm text-primary-400" role="alert">
          {error}
        </p>
      ) : null}
      <div className="w-full overflow-x-auto overflow-clip rounded-md border border-neutral-700 bg-surface-900/30">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="text-body-sm font-medium text-soft-400">
              <th className="px-lg py-md font-medium">Asset</th>
              <th className="w-[140px] px-lg py-md font-medium">Strike</th>
              <th className="w-[140px] px-lg py-md font-medium">Premium</th>
              <th className="w-[140px] px-lg py-md font-medium">Status</th>
              <th className="w-[140px] px-lg py-md font-medium">Expires</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-lg py-xl text-body-sm text-soft-300">
                  Loading positions…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-lg py-xl text-body-sm text-soft-300">
                  No active coverage. Open Protect to buy a policy.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const market = marketByAddress.get(row.market);
                return (
                  <tr key={row.market} className="border-t border-neutral-700">
                    <td className="px-lg py-md">
                      <div className="flex items-center gap-md">
                        <TokenLogo symbol={tokenLogoSymbol(row.assetSymbol)} />
                        <div className="flex flex-col text-body-sm">
                          <span className="font-medium text-white">{row.assetSymbol}</span>
                          <span className="text-soft-300">{nameFor(row.assetSymbol)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-lg py-md text-body-sm font-medium text-white">
                      {market ? formatStrike(market.strikePrice) : "-"}
                    </td>
                    <td className="px-lg py-md text-body-sm font-medium text-white">
                      {usd(fromBaseUnits(row.downBalance))}
                    </td>
                    <td className="px-lg py-md">
                      <span className="rounded-sm bg-surface-800 px-sm py-2xs text-body-sm font-medium text-success-500">
                        Active
                      </span>
                    </td>
                    <td className="px-lg py-md text-body-sm font-medium text-white">
                      {market ? `${daysUntil(market.expiryTs)}d` : "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {redeemable.length > 0 ? (
        <section className="flex w-full flex-col gap-lg overflow-clip rounded-md border border-neutral-700 bg-neutral-700/30 p-xl">
          <h2 className="text-h6 text-white">Ready to redeem</h2>
          {redeemable.map((position) => {
            const winningBalance =
              position.marketOutcome === "up" ? position.upBalance : position.downBalance;
            return (
              <div
                key={position.market}
                className="flex items-center justify-between rounded-sm bg-surface-800 px-lg py-md"
              >
                <div className="flex items-center gap-md">
                  <TokenLogo symbol={tokenLogoSymbol(position.assetSymbol)} />
                  <div className="flex flex-col">
                    <span className="text-body-md font-semibold text-white">
                      {nameFor(position.assetSymbol)} coverage settled
                    </span>
                    <span className="text-body-sm text-soft-300">
                      Payout: {usd(fromBaseUnits(winningBalance))} USDC
                    </span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={redeemingMarket === position.market}
                  onClick={() => void handleRedeem(position)}
                >
                  {redeemingMarket === position.market
                    ? "Redeeming…"
                    : `Redeem ${position.assetSymbol}`}
                </Button>
              </div>
            );
          })}
          {redeemError ? (
            <p className="m-0 text-body-sm text-primary-400" role="alert">
              {redeemError}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
