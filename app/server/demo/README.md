# Demo mode

For recording a product walkthrough without depending on real program/oracle state (market
expiry timing, resolution, Pyth staleness — all awkward to stage on demand on devnet).

Set `DEMO_MODE=true` in `app/.env.local` and restart `next dev`.

What changes:

- `POST /api/tx/*` still returns a real unsigned transaction for the connected wallet to sign —
  so Phantom's signing popup is genuine and the signature still confirms on devnet — but the
  instruction inside is a harmless SPL Memo, not the real Anchor instruction. No expiry check,
  staleness check, or resolved-market state can block the flow.
- `GET /api/markets`, `/api/markets/:id`, `/api/markets/:id/pool`, and
  `/api/users/:wallet/positions*` read from in-memory fixtures (`fixtures.ts`) instead of live
  program accounts. Balances update immediately after each "transaction" so the UI reflects the
  action right after the wallet popup is approved.
- Fixture state resets on server restart. It is not persisted anywhere.

What does NOT change: wallet connection, the Phantom popup itself, and the actual on-chain
signature/confirmation — those are all real. Only the instruction content and the market/pool/
position reads are mocked.

**Never enable `DEMO_MODE` in a real deployment** — it silently replaces every trade with a
no-op Memo instruction.
