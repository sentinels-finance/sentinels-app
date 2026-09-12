import "server-only";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { getAmmProgram, getMarketProgram } from "@/server/solana/anchor-client";
import { resolveMarketContext } from "@/server/solana/market-context";
import { PROGRAM_IDS } from "@/server/solana/programs";
import { buildUnsignedTransaction } from "@/server/lib/transaction";
import { BadRequestError } from "@/server/lib/errors";

function parseWallet(wallet: string): PublicKey {
  try {
    return new PublicKey(wallet);
  } catch {
    throw new BadRequestError(`Invalid wallet address: ${wallet}`);
  }
}

function parseAmount(amount: string): anchor.BN {
  if (!/^\d+$/.test(amount)) {
    throw new BadRequestError(`amount must be a positive integer string (base units), got: ${amount}`);
  }
  return new anchor.BN(amount);
}

async function mintCompleteSetIx(
  ctx: Awaited<ReturnType<typeof resolveMarketContext>>,
  userPubkey: PublicKey,
  amountBN: anchor.BN,
) {
  const program = getMarketProgram();
  const downMint = ctx.market.downMint as PublicKey;
  const upMint = ctx.market.upMint as PublicKey;

  return program.methods
    .mintCompleteSet(amountBN)
    .accounts({
      user: userPubkey,
      globalConfig: ctx.globalConfigPda,
      riskConfig: ctx.riskConfigPda,
      market: ctx.marketPubkey,
      vaultAuthority: ctx.vaultAuthorityPda,
      downMint,
      upMint,
      collateralTokenAccount: ctx.market.collateralTokenAccount,
      userUsdcAccount: getAssociatedTokenAddressSync(ctx.usdcMint, userPubkey),
      userDownAccount: getAssociatedTokenAddressSync(downMint, userPubkey),
      userUpAccount: getAssociatedTokenAddressSync(upMint, userPubkey),
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function buildMintTx(
  marketAddress: string,
  amount: string,
  wallet: string,
): Promise<string> {
  const userPubkey = parseWallet(wallet);
  const amountBN = parseAmount(amount);
  const ctx = await resolveMarketContext(marketAddress);

  const ix = await mintCompleteSetIx(ctx, userPubkey, amountBN);
  return buildUnsignedTransaction(userPubkey, [ix]);
}

/**
 * Builds the swap instruction plus the two idempotent ATA-create instructions it needs (see
 * the comment below on why) — shared by `buildSwapTx` and `buildProtectTx`.
 */
async function swapIxs(
  ctx: Awaited<ReturnType<typeof resolveMarketContext>>,
  userPubkey: PublicKey,
  sideIn: "down" | "up",
  amountInBN: anchor.BN,
  minAmountOutBN: anchor.BN,
) {
  const ammProgram = getAmmProgram();
  const downMint = ctx.market.downMint as PublicKey;
  const upMint = ctx.market.upMint as PublicKey;

  const [ammPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm"), ctx.marketPubkey.toBuffer()],
    PROGRAM_IDS.amm,
  );
  const poolDownAccount = getAssociatedTokenAddressSync(downMint, ammPoolPda, true);
  const poolUpAccount = getAssociatedTokenAddressSync(upMint, ammPoolPda, true);
  const userDownAccount = getAssociatedTokenAddressSync(downMint, userPubkey);
  const userUpAccount = getAssociatedTokenAddressSync(upMint, userPubkey);

  // Unlike mint_complete_set, `swap`'s user_down_account/user_up_account are plain `mut`, not
  // `init_if_needed` (see programs/amm/src/instructions/swap.rs) — the receiving side's ATA
  // must already exist, or the instruction reverts. A user swapping into a mint they've never
  // held before (e.g. first-ever purchase of DOWN) wouldn't have one yet, so create both
  // idempotently up front — a no-op if they already exist.
  const createDownAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    userPubkey,
    userDownAccount,
    userPubkey,
    downMint,
  );
  const createUpAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    userPubkey,
    userUpAccount,
    userPubkey,
    upMint,
  );

  const swapIx = await ammProgram.methods
    .swap(sideIn === "down" ? { down: {} } : { up: {} }, amountInBN, minAmountOutBN)
    .accounts({
      user: userPubkey,
      globalConfig: ctx.globalConfigPda,
      riskConfig: ctx.riskConfigPda,
      market: ctx.marketPubkey,
      ammPool: ammPoolPda,
      poolDownAccount,
      poolUpAccount,
      userDownAccount,
      userUpAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return [createDownAtaIx, createUpAtaIx, swapIx];
}

export async function buildSwapTx(
  marketAddress: string,
  sideIn: "down" | "up",
  amountIn: string,
  minAmountOut: string,
  wallet: string,
): Promise<string> {
  if (sideIn !== "down" && sideIn !== "up") {
    throw new BadRequestError(`sideIn must be "down" or "up", got: ${sideIn}`);
  }
  const userPubkey = parseWallet(wallet);
  const ctx = await resolveMarketContext(marketAddress);

  const ixs = await swapIxs(
    ctx,
    userPubkey,
    sideIn,
    parseAmount(amountIn),
    parseAmount(minAmountOut),
  );
  return buildUnsignedTransaction(userPubkey, ixs);
}

/**
 * `docs/PRD.md` functional requirement 3 / `docs/product/planned/m7-frontend.md`'s "Protect"
 * flow: one user action (USDC in → net DOWN exposure out), not two separate transactions the
 * frontend has to sequence and get the user to sign twice. Bundles `mint_complete_set` (USDC ->
 * equal DOWN+UP) with a `swap` of the freshly-minted UP side back into DOWN, in a single
 * transaction — both instructions land or neither does.
 *
 * `minDownOut` is the caller's slippage floor for the swap leg (same semantics as
 * `buildSwapTx`'s `minAmountOut`) — the frontend should compute it from a fresh `GET
 * .../pool` read, same as it would for a standalone swap.
 */
export async function buildProtectTx(
  marketAddress: string,
  amount: string,
  minDownOut: string,
  wallet: string,
): Promise<string> {
  const userPubkey = parseWallet(wallet);
  const amountBN = parseAmount(amount);
  const ctx = await resolveMarketContext(marketAddress);

  const mintIx = await mintCompleteSetIx(ctx, userPubkey, amountBN);
  // Selling the just-minted UP for more DOWN is what turns "hold both" into "net long
  // protection" — see docs/PRD.md's "Buying protection" user flow in ARCHITECTURE.md.
  const swapInstructions = await swapIxs(ctx, userPubkey, "up", amountBN, parseAmount(minDownOut));

  return buildUnsignedTransaction(userPubkey, [mintIx, ...swapInstructions]);
}

export async function buildRedeemTx(
  marketAddress: string,
  amount: string,
  wallet: string,
): Promise<string> {
  const userPubkey = parseWallet(wallet);
  const amountBN = parseAmount(amount);
  const ctx = await resolveMarketContext(marketAddress);
  const program = getMarketProgram();

  if (!("resolved" in ctx.market.status)) {
    throw new BadRequestError(
      `Market ${marketAddress} is not resolved yet — redeem is only available after resolve_market`,
    );
  }

  const downMint = ctx.market.downMint as PublicKey;
  const upMint = ctx.market.upMint as PublicKey;

  const ix = await program.methods
    .redeem(amountBN)
    .accounts({
      user: userPubkey,
      market: ctx.marketPubkey,
      vaultAuthority: ctx.vaultAuthorityPda,
      downMint,
      upMint,
      collateralTokenAccount: ctx.market.collateralTokenAccount,
      userUsdcAccount: getAssociatedTokenAddressSync(ctx.usdcMint, userPubkey),
      userDownAccount: getAssociatedTokenAddressSync(downMint, userPubkey),
      userUpAccount: getAssociatedTokenAddressSync(upMint, userPubkey),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return buildUnsignedTransaction(userPubkey, [ix]);
}

export async function buildMergeTx(
  marketAddress: string,
  amount: string,
  wallet: string,
): Promise<string> {
  const userPubkey = parseWallet(wallet);
  const amountBN = parseAmount(amount);
  const ctx = await resolveMarketContext(marketAddress);
  const program = getMarketProgram();

  const downMint = ctx.market.downMint as PublicKey;
  const upMint = ctx.market.upMint as PublicKey;

  const ix = await program.methods
    .mergeCompleteSet(amountBN)
    .accounts({
      user: userPubkey,
      market: ctx.marketPubkey,
      vaultAuthority: ctx.vaultAuthorityPda,
      downMint,
      upMint,
      collateralTokenAccount: ctx.market.collateralTokenAccount,
      userUsdcAccount: getAssociatedTokenAddressSync(ctx.usdcMint, userPubkey),
      userDownAccount: getAssociatedTokenAddressSync(downMint, userPubkey),
      userUpAccount: getAssociatedTokenAddressSync(upMint, userPubkey),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return buildUnsignedTransaction(userPubkey, [ix]);
}

async function getPoolContext(marketPubkey: PublicKey) {
  const [ammPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm"), marketPubkey.toBuffer()],
    PROGRAM_IDS.amm,
  );
  const ammProgram = getAmmProgram();
  let pool: Record<string, any>;
  try {
    pool = await (ammProgram.account as any).ammPool.fetch(ammPoolPda);
  } catch {
    throw new BadRequestError(`No AMM pool for market ${marketPubkey.toBase58()}`);
  }
  return { ammPoolPda, pool, ammProgram };
}

/**
 * `add_liquidity` needs equal DOWN+UP already sitting in the caller's accounts (per
 * docs/libs/API.md: "mint a complete set first if you only have USDC") and its
 * `user_down_account`/`user_up_account` are plain `mut`, not `init_if_needed` — so a wallet
 * that has only ever held USDC has neither the tokens nor the ATAs yet. Same shape as
 * `buildProtectTx`: bundle `mint_complete_set(usdcAmount)` (USDC -> equal DOWN+UP, and it does
 * create those ATAs) with `add_liquidity(usdcAmount, usdcAmount)` in one transaction, so LPs
 * only ever need to hold USDC.
 */
export async function buildAddLiquidityTx(
  marketAddress: string,
  usdcAmount: string,
  wallet: string,
): Promise<string> {
  const userPubkey = parseWallet(wallet);
  const amountBN = parseAmount(usdcAmount);
  const ctx = await resolveMarketContext(marketAddress);
  const { ammPoolPda, pool, ammProgram } = await getPoolContext(ctx.marketPubkey);

  const downMint = ctx.market.downMint as PublicKey;
  const upMint = ctx.market.upMint as PublicKey;
  const lpMint = pool.lpMint as PublicKey;
  const userLpAccount = getAssociatedTokenAddressSync(lpMint, userPubkey);

  const mintIx = await mintCompleteSetIx(ctx, userPubkey, amountBN);
  const addLiquidityIx = await ammProgram.methods
    .addLiquidity(amountBN, amountBN)
    .accounts({
      user: userPubkey,
      market: ctx.marketPubkey,
      ammPool: ammPoolPda,
      lpMint,
      downMint,
      upMint,
      poolDownAccount: getAssociatedTokenAddressSync(downMint, ammPoolPda, true),
      poolUpAccount: getAssociatedTokenAddressSync(upMint, ammPoolPda, true),
      userDownAccount: getAssociatedTokenAddressSync(downMint, userPubkey),
      userUpAccount: getAssociatedTokenAddressSync(upMint, userPubkey),
      userLpAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return buildUnsignedTransaction(userPubkey, [mintIx, addLiquidityIx]);
}

export async function buildRemoveLiquidityTx(
  marketAddress: string,
  lpAmount: string,
  wallet: string,
): Promise<string> {
  const userPubkey = parseWallet(wallet);
  const lpAmountBN = parseAmount(lpAmount);
  const ctx = await resolveMarketContext(marketAddress);
  const { ammPoolPda, pool, ammProgram } = await getPoolContext(ctx.marketPubkey);

  const downMint = ctx.market.downMint as PublicKey;
  const upMint = ctx.market.upMint as PublicKey;
  const lpMint = pool.lpMint as PublicKey;

  const ix = await ammProgram.methods
    .removeLiquidity(lpAmountBN)
    .accounts({
      user: userPubkey,
      market: ctx.marketPubkey,
      ammPool: ammPoolPda,
      lpMint,
      poolDownAccount: getAssociatedTokenAddressSync(downMint, ammPoolPda, true),
      poolUpAccount: getAssociatedTokenAddressSync(upMint, ammPoolPda, true),
      userDownAccount: getAssociatedTokenAddressSync(downMint, userPubkey),
      userUpAccount: getAssociatedTokenAddressSync(upMint, userPubkey),
      userLpAccount: getAssociatedTokenAddressSync(lpMint, userPubkey),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return buildUnsignedTransaction(userPubkey, [ix]);
}
