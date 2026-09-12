// One-off: mints a complete DOWN+UP set and deposits it as initial AMM liquidity, so a
// freshly seed-market.ts'd market's pool isn't EmptyPool when swap/protect is tested.
//   ANCHOR_PROVIDER_URL=... ANCHOR_WALLET=<funded keypair holding the market's usdc_mint> \
//     npx ts-node --transpile-only scripts/seed-pool-liquidity.ts --market <marketPda> --usdc <wholeUnits>
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const market = get("--market");
  const usdc = Number(get("--usdc") ?? "1000");
  if (!market) throw new Error("--market <marketPda> is required");
  return { market: new PublicKey(market), usdcWhole: usdc };
}

async function main() {
  const { market, usdcWhole } = parseArgs();
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const marketProgram = anchor.workspace.Market as Program;
  const ammProgram = anchor.workspace.Amm as Program;
  const user = (provider.wallet as anchor.Wallet).publicKey;
  const payer = (provider.wallet as anchor.Wallet).payer;

  const marketAccount = await marketProgram.account.market.fetch(market);
  const downMint = marketAccount.downMint as PublicKey;
  const upMint = marketAccount.upMint as PublicKey;
  const collateralTokenAccount = marketAccount.collateralTokenAccount as PublicKey;
  const collateralAccountInfo = await getAccount(provider.connection, collateralTokenAccount);
  const usdcMint = collateralAccountInfo.mint;

  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), market.toBuffer()],
    marketProgram.programId,
  );
  const [ammPool] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm"), market.toBuffer()],
    ammProgram.programId,
  );
  const poolAccount = await ammProgram.account.ammPool.fetch(ammPool);
  const lpMint = poolAccount.lpMint as PublicKey;
  const poolDownAccount = getAssociatedTokenAddressSync(downMint, ammPool, true);
  const poolUpAccount = getAssociatedTokenAddressSync(upMint, ammPool, true);

  const userUsdcAccount = getAssociatedTokenAddressSync(usdcMint, user);
  const userDownAccount = getAssociatedTokenAddressSync(downMint, user);
  const userUpAccount = getAssociatedTokenAddressSync(upMint, user);
  const userLpAccount = getAssociatedTokenAddressSync(lpMint, user);

  const amount = new anchor.BN(usdcWhole).mul(new anchor.BN(1_000_000));

  console.log(`Minting complete set: ${usdcWhole} USDC -> DOWN+UP`);
  await marketProgram.methods
    .mintCompleteSet(amount)
    .accounts({
      user,
      market,
      vaultAuthority,
      downMint,
      upMint,
      collateralTokenAccount,
      userUsdcAccount,
      userDownAccount,
      userUpAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as never)
    .signers(payer ? [payer] : [])
    .rpc();
  console.log("Minted complete set.");

  console.log(`Adding liquidity: ${usdcWhole} DOWN + ${usdcWhole} UP`);
  await ammProgram.methods
    .addLiquidity(amount, amount)
    .accounts({
      user,
      market,
      ammPool,
      lpMint,
      downMint,
      upMint,
      poolDownAccount,
      poolUpAccount,
      userDownAccount,
      userUpAccount,
      userLpAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    } as never)
    .signers(payer ? [payer] : [])
    .rpc();
  console.log("Liquidity added.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
