// Seeds one market + its AMM pool, so there's real data for the backend/frontend to read
// against instead of an empty `program.account.market.all()`. Idempotent — safe to re-run;
// skips whatever already exists instead of erroring.
//
// Same script works against localnet AND devnet — target cluster comes from the standard
// Anchor env vars, not a flag:
//   ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=~/.config/solana/id.json \
//     npx ts-node scripts/seed-market.ts [--asset BTC|ETH|SOL] [--usdc-mint <address>] [--weeks <n>]
//
// --weeks (default 1) picks the n-th upcoming Friday 00:00 UTC as expiry_ts, so a longer-dated
// market can be seeded alongside the default one without a PDA collision (expiry_ts is part of
// the Market PDA's seeds) — e.g. --weeks 4 for a market expiring 4 Fridays from now.
//
// Not part of `anchor test` / CI — this is a manual dev/demo-data tool, run by hand. Never
// targets mainnet (nothing here checks for it — don't point ANCHOR_PROVIDER_URL there).
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import feeds from "../config/pyth-feeds.json";

type AssetSymbol = "BTC" | "ETH" | "SOL";

// Demo strike prices only (admin-chosen at create_market, per docs/PRD.md — not read live from
// Pyth at creation time). Precision matches the feeds' own `expo` (-8, i.e. 1e8 per whole unit)
// — see docs/libs/API.md's note on strike/price precision.
const DEMO_STRIKE_PRICE: Record<AssetSymbol, number> = {
  BTC: 60_000 * 1e8,
  ETH: 3_000 * 1e8,
  SOL: 150 * 1e8,
};

/**
 * Next Friday 00:00 UTC, per docs/PRD.md's "fixed weekly expiry" design — and critically, a
 * *stable* value within the same week, unlike `now + 7 days` (which produces a different
 * expiry_ts, and therefore a different market PDA, every time the script runs — breaking the
 * idempotency this script otherwise relies on).
 */
function nextFridayMidnightUtc(weeksOut = 1): number {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysUntilFriday = (5 - d.getUTCDay() + 7) % 7 || 7; // Friday = 5; today doesn't count
  d.setUTCDate(d.getUTCDate() + daysUntilFriday + (weeksOut - 1) * 7);
  return Math.floor(d.getTime() / 1000);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const asset = (get("--asset") ?? "BTC").toUpperCase() as AssetSymbol;
  if (!(asset in DEMO_STRIKE_PRICE)) {
    throw new Error(`--asset must be one of BTC, ETH, SOL (got "${asset}")`);
  }
  const weeksArg = get("--weeks");
  const weeksOut = weeksArg ? Number(weeksArg) : 1;
  if (!Number.isInteger(weeksOut) || weeksOut < 1) {
    throw new Error(`--weeks must be a positive integer (got "${weeksArg}")`);
  }
  return { asset, usdcMintArg: get("--usdc-mint"), weeksOut };
}

async function main() {
  const { asset, usdcMintArg, weeksOut } = parseArgs();

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const configProgram = anchor.workspace.Config as Program;
  const marketProgram = anchor.workspace.Market as Program;
  const ammProgram = anchor.workspace.Amm as Program;
  const admin = provider.wallet as anchor.Wallet;

  console.log(`Cluster:  ${provider.connection.rpcEndpoint}`);
  console.log(`Admin:    ${admin.publicKey.toBase58()}`);
  console.log(`Asset:    ${asset}`);
  console.log(`Weeks:    ${weeksOut} (expiry = ${new Date(nextFridayMidnightUtc(weeksOut) * 1000).toISOString()})`);

  const feedKey = `${asset}/USD` as keyof typeof feeds.feeds;
  const feedHex = feeds.feeds[feedKey].feed_id.replace(/^0x/, "");
  const assetFeedId = new PublicKey(Buffer.from(feedHex, "hex"));

  // --- 1. GlobalConfig (idempotent) ---
  const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    configProgram.programId,
  );
  if (await provider.connection.getAccountInfo(globalConfigPda)) {
    console.log("GlobalConfig: already exists, skipping init");
  } else {
    await configProgram.methods
      .initializeConfig(admin.publicKey)
      .accounts({
        payer: admin.publicKey,
        globalConfig: globalConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("GlobalConfig: initialized");
  }

  // --- 2. RiskConfig for this asset (idempotent) ---
  const [riskConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("risk"), assetFeedId.toBuffer()],
    configProgram.programId,
  );
  if (await provider.connection.getAccountInfo(riskConfigPda)) {
    console.log(`RiskConfig(${asset}): already exists, skipping upsert`);
  } else {
    await configProgram.methods
      .upsertRiskConfig(
        assetFeedId,
        new anchor.BN(60), // max_staleness_secs
        100, // max_confidence_bps (1%)
        new anchor.BN(300), // trading_halt_secs (5 min)
        new anchor.BN(1_000_000_000), // lmsr_b_min
        true, // enabled
      )
      .accounts({
        admin: admin.publicKey,
        globalConfig: globalConfigPda,
        riskConfig: riskConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`RiskConfig(${asset}): upserted`);
  }

  // --- 3. USDC mint (reuse if given, else create a fresh test mint) ---
  let usdcMint: PublicKey;
  if (usdcMintArg) {
    usdcMint = new PublicKey(usdcMintArg);
    console.log(`USDC mint: reusing ${usdcMint.toBase58()}`);
  } else {
    usdcMint = await createMint(provider.connection, admin.payer, admin.publicKey, null, 6);
    console.log(`USDC mint: created ${usdcMint.toBase58()}`);
    console.log(
      `  -> save this and pass --usdc-mint ${usdcMint.toBase58()} next time to reuse it`,
    );
  }

  // --- 4. Market (idempotent) ---
  const strikePrice = new anchor.BN(DEMO_STRIKE_PRICE[asset]);
  const expiryTs = new anchor.BN(nextFridayMidnightUtc(weeksOut));

  const [marketPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("market"),
      assetFeedId.toBuffer(),
      strikePrice.toArrayLike(Buffer, "le", 8),
      expiryTs.toArrayLike(Buffer, "le", 8),
    ],
    marketProgram.programId,
  );
  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), marketPda.toBuffer()],
    marketProgram.programId,
  );

  let downMint: Keypair | null = null;
  let upMint: Keypair | null = null;

  if (await provider.connection.getAccountInfo(marketPda)) {
    console.log(`Market: already exists at ${marketPda.toBase58()}, skipping create`);
    const existing = await (marketProgram.account as any).market.fetch(marketPda);
    downMint = { publicKey: existing.downMint } as Keypair;
    upMint = { publicKey: existing.upMint } as Keypair;
  } else {
    downMint = Keypair.generate();
    upMint = Keypair.generate();
    const collateralTokenAccount = getAssociatedTokenAddressSync(
      usdcMint,
      vaultAuthorityPda,
      true,
    );

    await marketProgram.methods
      .createMarket(assetFeedId, strikePrice, expiryTs)
      .accounts({
        admin: admin.publicKey,
        globalConfig: globalConfigPda,
        riskConfig: riskConfigPda,
        market: marketPda,
        vaultAuthority: vaultAuthorityPda,
        downMint: downMint.publicKey,
        upMint: upMint.publicKey,
        usdcMint,
        collateralTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([downMint, upMint])
      .rpc();
    console.log(`Market: created at ${marketPda.toBase58()}`);
  }

  // --- 5. AMM pool (idempotent) ---
  const [ammPoolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm"), marketPda.toBuffer()],
    ammProgram.programId,
  );

  if (await provider.connection.getAccountInfo(ammPoolPda)) {
    console.log(`AmmPool: already exists at ${ammPoolPda.toBase58()}, skipping init`);
  } else {
    const lpMint = Keypair.generate();
    const poolDownAccount = getAssociatedTokenAddressSync(downMint.publicKey, ammPoolPda, true);
    const poolUpAccount = getAssociatedTokenAddressSync(upMint.publicKey, ammPoolPda, true);

    await ammProgram.methods
      .initPool(new anchor.BN(1_000_000_000), 30) // b = 1000 tokens, fee = 0.30%
      .accounts({
        admin: admin.publicKey,
        globalConfig: globalConfigPda,
        riskConfig: riskConfigPda,
        market: marketPda,
        ammPool: ammPoolPda,
        lpMint: lpMint.publicKey,
        downMint: downMint.publicKey,
        upMint: upMint.publicKey,
        poolDownAccount,
        poolUpAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([lpMint])
      .rpc();
    console.log(`AmmPool: initialized at ${ammPoolPda.toBase58()}`);
  }

  console.log("\nDone. Summary:");
  console.log(`  market:  ${marketPda.toBase58()}`);
  console.log(`  pool:    ${ammPoolPda.toBase58()}`);
  console.log(`  usdc:    ${usdcMint.toBase58()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
