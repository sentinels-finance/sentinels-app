import "server-only";
import { PublicKey } from "@solana/web3.js";
import { BadRequestError, NotFoundError } from "@/server/lib/errors";
import { getMarketProgram } from "@/server/solana/anchor-client";
import { symbolForFeedId, KNOWN_ASSET_SYMBOLS } from "@/server/solana/assets";
import { env } from "@/server/lib/env";
import { listDemoMarkets, getDemoMarket } from "@/server/demo/fixtures";
import type { Market, MarketOutcome, MarketStatus } from "@/server/types/market";

/**
 * Decodes an Anchor account's Rust-style enum (`{ active: {} }`) into the lowercase string
 * key our `Market` type uses. Anchor's TS coder already lowercases the first letter of the
 * variant name, so `Object.keys(...)[0]` lines up with `MarketStatus`/`MarketOutcome` as-is —
 * see `programs/market/src/state.rs` for the source enums.
 */
function variantKey<T extends string>(enumValue: Record<string, unknown>): T {
  return Object.keys(enumValue)[0] as T;
}

/**
 * Maps a decoded on-chain `Market` account to the API's `Market` type. Field names below are
 * camelCase because `@coral-xyz/anchor`'s account coder camelCases the IDL's snake_case field
 * names on decode (confirmed against `tests/market.ts`, e.g. `market.totalCollateral`) — do
 * not "fix" these back to snake_case.
 */
function toApiMarket(address: PublicKey, account: Record<string, any>): Market {
  const symbol = symbolForFeedId(account.assetFeedId as PublicKey);
  return {
    address: address.toBase58(),
    assetFeedId: (account.assetFeedId as PublicKey).toBase58(),
    // Fallback keeps this from throwing if a market is ever created for an asset outside the
    // 3 known devnet feeds — better to surface "unknown" than 500 the whole list endpoint.
    assetSymbol: symbol ?? ("UNKNOWN" as Market["assetSymbol"]),
    strikePrice: account.strikePrice.toString(),
    expiryTs: account.expiryTs.toNumber(),
    downMint: (account.downMint as PublicKey).toBase58(),
    upMint: (account.upMint as PublicKey).toBase58(),
    collateralTokenAccount: (account.collateralTokenAccount as PublicKey).toBase58(),
    totalCollateral: account.totalCollateral.toString(),
    // On-chain `MarketStatus` is only ever `Active`/`Resolved` — the `haltedForTrading` case
    // in this type is a *derived* state (expiry - RiskConfig.trading_halt_secs < now < expiry),
    // not a distinct on-chain value. Not computed here yet: doing so needs a RiskConfig read
    // per asset too, which this service doesn't fetch. Revisit once `/api/assets` exists.
    status: variantKey<MarketStatus>(account.status),
    outcome: variantKey<MarketOutcome>(account.outcome),
    resolvedPrice: account.resolvedPrice ? account.resolvedPrice.toString() : null,
    resolvedAt: account.resolvedAt ? account.resolvedAt.toNumber() : null,
  };
}

// `program.account` is typed as `AccountNamespace<Idl>` here because `getMarketProgram()`
// deliberately casts the imported JSON as the generic `Idl` type (see anchor-client.ts) rather
// than a codegen'd literal type — so TS has no static knowledge of "market" as an account name.
// The `market` account client exists at runtime regardless (Anchor builds it dynamically from
// the actual IDL content); `as any` here bypasses the compile-time check for that one dynamic
// lookup, not for anything downstream — `toApiMarket` still validates/converts every field it
// reads off the decoded result.
function marketAccountClient(program: ReturnType<typeof getMarketProgram>) {
  return (program.account as any).market;
}

export type MarketFilters = {
  asset?: string;
  status?: string;
};

function validateFilters(filters: MarketFilters): void {
  if (filters.asset !== undefined && !(KNOWN_ASSET_SYMBOLS as readonly string[]).includes(filters.asset)) {
    throw new BadRequestError(
      `Invalid ?asset=${filters.asset} — must be one of ${KNOWN_ASSET_SYMBOLS.join(", ")}`,
    );
  }
  if (filters.status !== undefined && filters.status !== "active" && filters.status !== "resolved") {
    throw new BadRequestError(`Invalid ?status=${filters.status} — must be "active" or "resolved"`);
  }
}

export async function listMarkets(filters: MarketFilters = {}): Promise<Market[]> {
  validateFilters(filters);

  if (env.demoMode) {
    let markets = listDemoMarkets();
    if (filters.asset) markets = markets.filter((m) => m.assetSymbol === filters.asset);
    if (filters.status) markets = markets.filter((m) => m.status === filters.status);
    return markets;
  }

  const program = getMarketProgram();
  const entries = await marketAccountClient(program).all();
  let markets: Market[] = entries.map(
    ({ publicKey, account }: { publicKey: PublicKey; account: any }) =>
      toApiMarket(publicKey, account),
  );

  if (filters.asset) {
    markets = markets.filter((m) => m.assetSymbol === filters.asset);
  }
  if (filters.status) {
    // Deliberately matches only "active"/"resolved" (not the derived "haltedForTrading" state
    // — see toApiMarket's comment; that's never actually produced today).
    markets = markets.filter((m) => m.status === filters.status);
  }
  return markets;
}

export async function getMarket(address: string): Promise<Market> {
  if (env.demoMode) {
    const market = getDemoMarket(address);
    if (!market) throw new NotFoundError(`No market at address ${address}`);
    return market;
  }

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(address);
  } catch {
    throw new NotFoundError(`Invalid market address: ${address}`);
  }

  const program = getMarketProgram();
  try {
    const account = await marketAccountClient(program).fetch(pubkey);
    return toApiMarket(pubkey, account);
  } catch {
    // Anchor throws when the account doesn't exist or fails discriminator/deserialization
    // checks — either way, that's "no market here" from the API's point of view, not a 500.
    throw new NotFoundError(`No market at address ${address}`);
  }
}
