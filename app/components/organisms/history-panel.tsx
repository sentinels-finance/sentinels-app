"use client";

import { useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { Button } from "@/components/atoms/button";
import { TokenLogo } from "@/components/atoms/token-logo";
import { formatStrike, fromBaseUnits, nameFor, tokenLogoSymbol, usd } from "@/lib/app-format";
import { cn } from "@/lib/utils";
import { usePositionsWithMarkets } from "@/lib/wallet/use-positions";

const TOKEN_FILTERS = ["all", "SOL", "BTC", "ETH"] as const;
const OUTCOME_FILTERS = [
  { value: "all", label: "All outcomes" },
  { value: "paid", label: "Paid out" },
  { value: "expired", label: "No payout" },
] as const;

export function HistoryPanel() {
  const { open } = useAppKit();
  const [outcome, setOutcome] = useState<(typeof OUTCOME_FILTERS)[number]["value"]>("all");
  const [token, setToken] = useState<(typeof TOKEN_FILTERS)[number]>("all");
  const { positions, marketByAddress, loading, error, connected } = usePositionsWithMarkets(0);

  const resolved = positions.filter((position) => position.marketStatus === "resolved");
  const withOutcome = resolved.map((position) => ({
    position,
    paid: position.marketOutcome === "down",
  }));
  const rows = withOutcome.filter(({ position, paid }) => {
    if (outcome === "paid" && !paid) return false;
    if (outcome === "expired" && paid) return false;
    if (token !== "all" && position.assetSymbol !== token) return false;
    return true;
  });

  if (!connected) {
    return (
      <div className="flex w-full flex-col items-start gap-md rounded-md border border-neutral-700 bg-surface-900/30 p-xl">
        <p className="m-0 text-body-md text-white">Connect a wallet to view your history</p>
        <Button variant="primary" size="sm" onClick={() => open({ view: "Connect" })}>
          Connect Wallet
        </Button>
      </div>
    );
  }

  const outcomeLabel = OUTCOME_FILTERS.find((item) => item.value === outcome)?.label ?? "All outcomes";

  return (
    <div className="flex w-full flex-col gap-xl">
      <div className="flex flex-wrap gap-md">
        <button
          type="button"
          className="flex items-center gap-md rounded-sm border border-neutral-700 bg-surface-900 px-lg py-sm text-body-sm"
          onClick={() => {
            const index = OUTCOME_FILTERS.findIndex((item) => item.value === outcome);
            setOutcome(OUTCOME_FILTERS[(index + 1) % OUTCOME_FILTERS.length].value);
          }}
        >
          <span className="text-soft-300">Outcome</span>
          <span className="font-medium text-white">{outcomeLabel}</span>
        </button>
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
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="text-body-sm font-medium text-soft-400">
              <th className="px-lg py-md font-medium">Asset</th>
              <th className="w-[130px] px-lg py-md font-medium">Strike</th>
              <th className="w-[130px] px-lg py-md font-medium">Premium</th>
              <th className="w-[130px] px-lg py-md font-medium">Status</th>
              <th className="w-[130px] px-lg py-md font-medium">Result</th>
              <th className="w-[130px] px-lg py-md font-medium">Resolved</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-lg py-xl text-body-sm text-soft-300">
                  Loading history…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-lg py-xl text-body-sm text-soft-300">
                  No history matches these filters
                </td>
              </tr>
            ) : (
              rows.map(({ position, paid }) => {
                const market = marketByAddress.get(position.market);
                return (
                  <tr key={position.market} className="border-t border-neutral-700">
                    <td className="px-lg py-md">
                      <div className="flex items-center gap-md">
                        <TokenLogo symbol={tokenLogoSymbol(position.assetSymbol)} />
                        <div className="flex flex-col text-body-sm">
                          <span className="font-medium text-white">{position.assetSymbol}</span>
                          <span className="text-soft-300">{nameFor(position.assetSymbol)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-lg py-md text-body-sm font-medium text-white">
                      {market ? formatStrike(market.strikePrice) : "-"}
                    </td>
                    <td className="px-lg py-md text-body-sm font-medium text-white">-</td>
                    <td className="px-lg py-md">
                      <span
                        className={cn(
                          "rounded-sm bg-surface-800 px-sm py-2xs text-body-sm font-medium",
                          paid ? "text-success-500" : "text-soft-400",
                        )}
                      >
                        {paid ? "Paid out" : "No payout"}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-lg py-md text-body-sm font-medium",
                        paid ? "text-success-500" : "text-soft-400",
                      )}
                    >
                      {paid ? `+${usd(fromBaseUnits(position.downBalance))}` : "Expired"}
                    </td>
                    <td className="px-lg py-md text-body-sm font-medium text-white">
                      {market?.resolvedAt ? new Date(market.resolvedAt * 1000).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
