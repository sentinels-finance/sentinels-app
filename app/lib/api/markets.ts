export type MarketStatus = "active" | "haltedForTrading" | "resolved";
export type MarketOutcome = "unresolved" | "down" | "up";

export type Market = {
  address: string;
  assetFeedId: string;
  assetSymbol: "BTC" | "ETH" | "SOL";
  strikePrice: string;
  expiryTs: number;
  downMint: string;
  upMint: string;
  collateralTokenAccount: string;
  totalCollateral: string;
  status: MarketStatus;
  outcome: MarketOutcome;
  resolvedPrice: string | null;
  resolvedAt: number | null;
};

export async function fetchMarkets(params?: {
  asset?: string;
  status?: string;
}): Promise<Market[]> {
  const search = new URLSearchParams();
  if (params?.asset) search.set("asset", params.asset);
  if (params?.status) search.set("status", params.status);
  const query = search.toString();
  const response = await fetch(`/api/markets${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't load markets.");
  }
  const payload = (await response.json()) as { markets: Market[] };
  return payload.markets;
}

export async function fetchMarket(marketId: string): Promise<Market> {
  const response = await fetch(`/api/markets/${marketId}`, { cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't load market.");
  }
  const payload = (await response.json()) as { market: Market };
  return payload.market;
}
