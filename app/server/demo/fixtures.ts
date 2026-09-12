import "server-only";
import { Keypair } from "@solana/web3.js";
import { priceDown, priceUp } from "@/server/solana/lmsr";
import type { Market } from "@/server/types/market";
import type { Pool } from "@/server/types/pool";
import type { Position } from "@/server/types/position";

/**
 * In-memory fixtures backing demo mode (`env.demoMode` — see `server/demo/README.md`). Resets
 * whenever the server restarts; that's fine, this only exists to make a screen-recording look
 * like a working product without depending on real program/oracle state (market expiry,
 * resolution timing, Pyth staleness) that's awkward to stage on demand.
 *
 * Addresses are real `Keypair`-generated pubkeys (not on-chain accounts) purely so every
 * `new PublicKey(...)` call elsewhere in the codebase keeps working unmodified.
 */

type DemoMarket = Market & { b: number; feeBps: number };

function freshAddress(): string {
  return Keypair.generate().publicKey.toBase58();
}

const now = Math.floor(Date.now() / 1000);

const demoMarkets = new Map<string, DemoMarket>();
const demoPoolState = new Map<string, { qDown: number; qUp: number; poolDown: bigint; poolUp: bigint; lpSupply: bigint }>();
// key: `${wallet}|${marketAddress}`
const demoPositions = new Map<string, { down: bigint; up: bigint; lp: bigint }>();

function seedMarket(params: {
  assetSymbol: Market["assetSymbol"];
  strikePrice: string;
  expiryTs: number;
  status: Market["status"];
  outcome: Market["outcome"];
  resolvedPrice: string | null;
  resolvedAt: number | null;
}) {
  const address = freshAddress();
  const market: DemoMarket = {
    address,
    assetFeedId: freshAddress(),
    assetSymbol: params.assetSymbol,
    strikePrice: params.strikePrice,
    expiryTs: params.expiryTs,
    downMint: freshAddress(),
    upMint: freshAddress(),
    collateralTokenAccount: freshAddress(),
    totalCollateral: "5000000000",
    status: params.status,
    outcome: params.outcome,
    resolvedPrice: params.resolvedPrice,
    resolvedAt: params.resolvedAt,
    b: 2_000_000,
    feeBps: 30,
  };
  demoMarkets.set(address, market);
  demoPoolState.set(address, {
    qDown: -150_000,
    qUp: 150_000,
    poolDown: 2_500_000_000n,
    poolUp: 2_500_000_000n,
    lpSupply: 5_000_000_000n,
  });
  return address;
}

// Three tenors per asset (`/market`'s expiry slider groups markets by assetSymbol and sorts by
// expiryTs, so this is what makes 3d/14d/30d show up as slider stops) — see
// `app/app/market/page.tsx`'s `marketsForAsset`.
const DAY = 60 * 60 * 24;
const TENORS_DAYS = [3, 14, 30] as const;

const ASSET_STRIKES: Record<"BTC" | "ETH" | "SOL", string> = {
  BTC: "60000000000", // $60,000.00 (8dp, matches Pyth BTC/USD exponent)
  ETH: "3200000000", // $3,200.00
  SOL: "140000000", // $140.00
};

for (const assetSymbol of ["BTC", "ETH", "SOL"] as const) {
  for (const days of TENORS_DAYS) {
    seedMarket({
      assetSymbol,
      strikePrice: ASSET_STRIKES[assetSymbol],
      expiryTs: now + days * DAY,
      status: "active",
      outcome: "unresolved",
      resolvedPrice: null,
      resolvedAt: null,
    });
  }
}

// A separate, already-resolved market to demo Redeem. `/market`'s Protect view only fetches
// `status=active` markets (see fetchMarkets({ status: "active" }) in page.tsx), so this never
// shows up as a 4th tenor there — but it's unfiltered on the positions/redeem list.
const resolvedSolMarket = seedMarket({
  assetSymbol: "SOL",
  strikePrice: ASSET_STRIKES.SOL,
  expiryTs: now - 60 * 30,
  status: "resolved",
  outcome: "down",
  resolvedPrice: "128500000",
  resolvedAt: now - 60 * 5,
});
// Give every wallet a starting DOWN balance on the resolved market so Redeem has something to
// show on first load, without needing a Protect pass first.
const DEFAULT_RESOLVED_DOWN_BALANCE = 25_000_000n; // 25 USDC, 6dp

function positionKey(wallet: string, market: string): string {
  return `${wallet}|${market}`;
}

function getOrInitPosition(wallet: string, market: string) {
  const key = positionKey(wallet, market);
  let pos = demoPositions.get(key);
  if (!pos) {
    pos = {
      down: market === resolvedSolMarket ? DEFAULT_RESOLVED_DOWN_BALANCE : 0n,
      up: 0n,
      lp: 0n,
    };
    demoPositions.set(key, pos);
  }
  return pos;
}

export function listDemoMarkets(): Market[] {
  return Array.from(demoMarkets.values());
}

export function getDemoMarket(address: string): Market | null {
  return demoMarkets.get(address) ?? null;
}

export function getDemoPool(marketAddress: string): Pool | null {
  const market = demoMarkets.get(marketAddress);
  const state = demoPoolState.get(marketAddress);
  if (!market || !state) return null;
  return {
    address: freshAddress(),
    market: marketAddress,
    b: String(market.b),
    qDown: String(state.qDown),
    qUp: String(state.qUp),
    feeBps: market.feeBps,
    lpMint: freshAddress(),
    lpSupply: state.lpSupply.toString(),
    poolDownBalance: state.poolDown.toString(),
    poolUpBalance: state.poolUp.toString(),
    priceDown: priceDown(state.qDown, state.qUp, market.b),
    priceUp: priceUp(state.qDown, state.qUp, market.b),
  };
}

export function getDemoPosition(wallet: string, marketAddress: string): Position | null {
  const market = demoMarkets.get(marketAddress);
  if (!market) return null;
  const pos = getOrInitPosition(wallet, marketAddress);
  return {
    market: marketAddress,
    assetSymbol: market.assetSymbol,
    downBalance: pos.down.toString(),
    upBalance: pos.up.toString(),
    lpBalance: pos.lp.toString(),
    marketStatus: market.status,
    marketOutcome: market.outcome,
    resolvedPrice: market.resolvedPrice,
  };
}

export function listDemoPositions(wallet: string): Position[] {
  return listDemoMarkets().map((m) => getDemoPosition(wallet, m.address)!);
}

/** amount minted as a complete set: DOWN and UP both increase 1:1 with USDC in. */
export function applyDemoMint(wallet: string, market: string, amount: bigint) {
  const pos = getOrInitPosition(wallet, market);
  pos.down += amount;
  pos.up += amount;
}

/**
 * Swaps `amountIn` of `sideIn` for the other side. A flat 97% fill approximates the AMM's
 * fee/slippage without reimplementing LMSR for fixture data.
 */
export function applyDemoSwap(wallet: string, market: string, sideIn: "down" | "up", amountIn: bigint) {
  const pos = getOrInitPosition(wallet, market);
  const amountOut = (amountIn * 97n) / 100n;
  if (sideIn === "down") {
    pos.down = pos.down > amountIn ? pos.down - amountIn : 0n;
    pos.up += amountOut;
  } else {
    pos.up = pos.up > amountIn ? pos.up - amountIn : 0n;
    pos.down += amountOut;
  }
}

/** Protect = mint_complete_set + swap(UP -> DOWN): mint the pair, then sell the UP leg. */
export function applyDemoProtect(wallet: string, market: string, amount: bigint) {
  applyDemoMint(wallet, market, amount);
  applyDemoSwap(wallet, market, "up", amount);
}

export function applyDemoRedeem(wallet: string, market: string, amount: bigint) {
  const pos = getOrInitPosition(wallet, market);
  const m = demoMarkets.get(market);
  if (m?.outcome === "up") {
    pos.up = pos.up > amount ? pos.up - amount : 0n;
  } else {
    pos.down = pos.down > amount ? pos.down - amount : 0n;
  }
}

export function applyDemoMerge(wallet: string, market: string, amount: bigint) {
  const pos = getOrInitPosition(wallet, market);
  pos.down = pos.down > amount ? pos.down - amount : 0n;
  pos.up = pos.up > amount ? pos.up - amount : 0n;
}

export function applyDemoAddLiquidity(wallet: string, market: string, usdcAmount: bigint) {
  const pos = getOrInitPosition(wallet, market);
  pos.lp += usdcAmount;
  const state = demoPoolState.get(market);
  if (state) {
    state.poolDown += usdcAmount;
    state.poolUp += usdcAmount;
    state.lpSupply += usdcAmount;
  }
}

export function applyDemoRemoveLiquidity(wallet: string, market: string, lpAmount: bigint) {
  const pos = getOrInitPosition(wallet, market);
  const capped = pos.lp < lpAmount ? pos.lp : lpAmount;
  pos.lp -= capped;
  const half = capped / 2n;
  pos.down += half;
  pos.up += half;
  const state = demoPoolState.get(market);
  if (state) {
    state.poolDown -= half;
    state.poolUp -= half;
    state.lpSupply -= capped;
  }
}
