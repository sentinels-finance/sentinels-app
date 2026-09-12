export type Pool = {
  address: string;
  market: string;
  b: string;
  qDown: string;
  qUp: string;
  feeBps: number;
  lpMint: string;
  lpSupply: string;
  poolDownBalance: string;
  poolUpBalance: string;
  priceDown: number;
  priceUp: number;
};

export async function fetchPool(marketId: string): Promise<Pool> {
  const response = await fetch(`/api/markets/${marketId}/pool`, { cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't load pool.");
  }
  const payload = (await response.json()) as { pool: Pool };
  return payload.pool;
}
