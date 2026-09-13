import { cn } from "@/lib/utils";

const logos = {
  SOL: "/app/icon-sol.svg",
  BTC: "/app/icon-btc.svg",
  ETH: "/app/icon-eth.svg",
} as const;

export type TokenSymbol = keyof typeof logos;

export function TokenLogo({ symbol, className }: { symbol: TokenSymbol; className?: string }) {
  return (
    <span
      className={cn(
        "relative size-8 shrink-0 overflow-clip",
        symbol === "BTC" ? "rounded-[13.333px]" : "rounded-full",
        className,
      )}
    >
      <img alt="" src={logos[symbol]} className="absolute inset-0 block size-8 max-w-none" />
    </span>
  );
}
