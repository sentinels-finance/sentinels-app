/**
 * Server-only environment access. Never import this from a Client Component —
 * it's a thin wrapper, not a secrets boundary, but keeping the import server-only
 * makes accidental client bundling fail loudly instead of leaking silently.
 */
import "server-only";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  solanaRpcUrl: required("SOLANA_RPC_URL", "https://api.devnet.solana.com"),
  solanaMainnetRpcUrl: required(
    "SOLANA_MAINNET_RPC_URL",
    "https://api.mainnet-beta.solana.com",
  ),
  solanaCluster: required("SOLANA_CLUSTER", "devnet"),
  /**
   * Demo mode: `/api/tx/*` routes swap the real Anchor instructions for a Memo instruction on
   * the same connection, so the connected wallet still shows a genuine signing popup and the
   * signature still lands on-chain — but no program account (staleness/expiry included) can
   * block the flow. Market/pool/position reads switch to in-memory fixtures. See
   * `server/demo/README.md`. Never enable in a real deployment.
   */
  demoMode: process.env.DEMO_MODE === "true",
};
