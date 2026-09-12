import type { MarketOutcome, MarketStatus } from "@/lib/api/markets";

export type Position = {
  market: string;
  assetSymbol: "BTC" | "ETH" | "SOL" | "UNKNOWN";
  downBalance: string;
  upBalance: string;
  lpBalance: string;
  marketStatus: MarketStatus;
  marketOutcome: MarketOutcome;
  resolvedPrice: string | null;
};

export async function fetchPositions(wallet: string): Promise<Position[]> {
  const response = await fetch(`/api/users/${wallet}/positions`, { cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't load positions.");
  }
  const payload = (await response.json()) as { positions: Position[] };
  return payload.positions;
}

export async function fetchPosition(wallet: string, marketId: string): Promise<Position> {
  const response = await fetch(`/api/users/${wallet}/positions/${marketId}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't load position.");
  }
  const payload = (await response.json()) as { position: Position };
  return payload.position;
}
