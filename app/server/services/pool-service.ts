import "server-only";
import { PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";
import { getConnection } from "@/server/solana/connection";
import { NotFoundError } from "@/server/lib/errors";
import { getAmmProgram, getMarketProgram } from "@/server/solana/anchor-client";
import { PROGRAM_IDS } from "@/server/solana/programs";
import { priceDown, priceUp } from "@/server/solana/lmsr";
import { env } from "@/server/lib/env";
import { getDemoPool } from "@/server/demo/fixtures";
import type { Pool } from "@/server/types/pool";

// See market-service.ts's `marketAccountClient` comment — same reason for the `any` here:
// the IDL is cast to the generic `Idl` type, so TS has no static knowledge of "ammPool" as an
// account name, even though it exists at runtime.
function ammPoolAccountClient(program: ReturnType<typeof getAmmProgram>) {
  return (program.account as any).ammPool;
}

export async function getPool(marketAddress: string): Promise<Pool> {
  if (env.demoMode) {
    const pool = getDemoPool(marketAddress);
    if (!pool) throw new NotFoundError(`No AMM pool for market ${marketAddress}`);
    return pool;
  }

  let marketPubkey: PublicKey;
  try {
    marketPubkey = new PublicKey(marketAddress);
  } catch {
    throw new NotFoundError(`Invalid market address: ${marketAddress}`);
  }

  const [poolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm"), marketPubkey.toBuffer()],
    PROGRAM_IDS.amm,
  );

  const program = getAmmProgram();
  let account: Record<string, any>;
  try {
    account = await ammPoolAccountClient(program).fetch(poolPda);
  } catch {
    // No pool yet for this market (init_pool never called) is the common case — not a 500.
    throw new NotFoundError(`No AMM pool for market ${marketAddress}`);
  }

  // q_down/q_up are i64 on-chain, decoded as BN — `.toNumber()` here (not `.toString()`) is
  // deliberate: lmsr.ts needs actual JS numbers to divide by `b`, and these values stay well
  // within Number.MAX_SAFE_INTEGER for any realistic pool size (native units, 6 decimals).
  const qDown = account.qDown.toNumber();
  const qUp = account.qUp.toNumber();
  const b = account.b.toNumber();
  const lpMint = account.lpMint as PublicKey;

  // `AmmPool` doesn't store down_mint/up_mint itself (see programs/amm/src/state.rs) — only
  // `Market` does. Needed here for two things `q_down`/`q_up` can't answer: the pool's real
  // token balances (q_down/q_up are LMSR's internal "net sold" counters, NOT token account
  // balances — remove_liquidity.rs computes payout from the real balances, not these) and the
  // LP mint's total supply, together enough for a frontend to show TVL / a wallet's pool share
  // / a remove_liquidity preview without a separate RPC call of its own.
  const market = await (getMarketProgram().account as any).market.fetch(marketPubkey);
  const downMint = market.downMint as PublicKey;
  const upMint = market.upMint as PublicKey;
  const connection = getConnection();

  const [poolDownAccount, poolUpAccount, lpMintInfo] = await Promise.all([
    getAccount(connection, getAssociatedTokenAddressSync(downMint, poolPda, true)),
    getAccount(connection, getAssociatedTokenAddressSync(upMint, poolPda, true)),
    getMint(connection, lpMint),
  ]);

  return {
    address: poolPda.toBase58(),
    market: marketPubkey.toBase58(),
    b: account.b.toString(),
    qDown: account.qDown.toString(),
    qUp: account.qUp.toString(),
    feeBps: account.feeBps,
    lpMint: lpMint.toBase58(),
    lpSupply: lpMintInfo.supply.toString(),
    poolDownBalance: poolDownAccount.amount.toString(),
    poolUpBalance: poolUpAccount.amount.toString(),
    priceDown: priceDown(qDown, qUp, b),
    priceUp: priceUp(qDown, qUp, b),
  };
}
