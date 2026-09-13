import "server-only";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { buildUnsignedTransaction } from "@/server/lib/transaction";

// Well-known SPL Memo program — no accounts needed, so this is the cheapest instruction that
// still shows up as a real, confirmable transaction to a connected wallet.
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/**
 * Builds a real, signable devnet transaction (a single Memo instruction) standing in for the
 * actual Anchor instruction for a given action. Used only when `env.demoMode` is on — see
 * `server/demo/README.md` for why: it lets a wallet's signing popup and on-chain confirmation
 * stay genuine for a demo recording, without depending on program state (market expiry,
 * resolution, staleness) that isn't easy to stage on demand.
 */
export async function buildDemoTx(feePayer: PublicKey, memo: string): Promise<string> {
  const ix = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf-8"),
  });
  return buildUnsignedTransaction(feePayer, [ix]);
}
