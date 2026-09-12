// Creates three throwaway SPL token mints on devnet — a USDC-like, wBTC-like, and cbBTC-like
// token — so the frontend has something real to read balances for while devnet's real
// GlobalConfig admin key is unavailable (see PR #9 discussion — create_market itself still
// needs that key; this script only needs devnet SOL).
//
// Idempotent: writes addresses to config/devnet-test-mints.json and reuses them on re-run
// instead of minting new tokens every time. Mint authority stays with the payer (not
// revoked) so more supply can be minted later with `--mint-more`.
//
//   ANCHOR_WALLET=~/.config/solana/id.json npx ts-node --transpile-only \
//     scripts/create-devnet-test-tokens.ts --owner <wallet-to-receive-tokens> [--mint-more]
//
// --transpile-only is required: the root tsconfig.json's `types: ["mocha", "chai"]` excludes
// @types/node, so this script's plain Node built-ins (fs/path/os/process) fail type-checking
// under plain `ts-node` even though they run fine — same as any other Node script here.
//
// Not part of `anchor test` / CI — manual dev/demo-data tool. Never targets mainnet.
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CONFIG_PATH = path.join(__dirname, "..", "config", "devnet-test-mints.json");

type TestToken = {
  key: "usdc" | "wbtc" | "cbbtc";
  symbol: string;
  decimals: number;
  supplyWhole: number; // whole-token amount minted per run
};

const TOKENS: TestToken[] = [
  { key: "usdc", symbol: "USDC", decimals: 6, supplyWhole: 1_000_000 },
  { key: "wbtc", symbol: "wBTC", decimals: 8, supplyWhole: 100 },
  { key: "cbbtc", symbol: "cbBTC", decimals: 8, supplyWhole: 100 },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return { owner: get("--owner"), mintMore: args.includes("--mint-more") };
}

function loadKeypair(walletPath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(raw));
}

function loadExisting(): Record<string, string> {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

async function main() {
  const { owner: ownerArg, mintMore } = parseArgs();

  const rpcUrl = process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
  const walletPath =
    process.env.ANCHOR_WALLET ?? path.join(os.homedir(), ".config", "solana", "id.json");
  const connection = new Connection(rpcUrl, "confirmed");
  const payer = loadKeypair(walletPath);
  const owner = ownerArg ? new PublicKey(ownerArg) : payer.publicKey;

  console.log(`Cluster: ${rpcUrl}`);
  console.log(`Payer:   ${payer.publicKey.toBase58()}`);
  console.log(`Owner:   ${owner.toBase58()}${ownerArg ? "" : " (defaulted to payer)"}`);

  const existing = loadExisting();
  const result: Record<string, string> = { ...existing };

  for (const token of TOKENS) {
    let mint: PublicKey;
    const already = existing[token.key];

    if (already && !mintMore) {
      mint = new PublicKey(already);
      console.log(`${token.symbol} mint: reusing ${mint.toBase58()}`);
    } else if (already) {
      mint = new PublicKey(already);
      console.log(`${token.symbol} mint: reusing ${mint.toBase58()}, minting more supply`);
    } else {
      mint = await createMint(connection, payer, payer.publicKey, null, token.decimals);
      console.log(`${token.symbol} mint: created ${mint.toBase58()}`);
    }

    const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, owner);
    const amount = BigInt(token.supplyWhole) * BigInt(10 ** token.decimals);
    await mintTo(connection, payer, mint, ata.address, payer, amount);
    console.log(
      `${token.symbol}: minted ${token.supplyWhole.toLocaleString()} to ${ata.address.toBase58()}`,
    );

    result[token.key] = mint.toBase58();
  }

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(result, null, 2) + "\n");
  console.log(`\nSaved mint addresses to ${path.relative(process.cwd(), CONFIG_PATH)}`);
  console.log(
    "\nWhen create_market is unblocked, pass `--usdc-mint " +
      result.usdc +
      "` to seed-market.ts so the market's collateral matches this test USDC.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
