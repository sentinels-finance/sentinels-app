# Backend API scaffold

**Status:** prototype
**Owner milestone:** `docs/product/planned/m6-typescript-sdk.md`, `docs/product/planned/m7-frontend.md`

## Problem

The frontend needs a server-side layer to read on-chain state (market list, market detail) and,
eventually, mediate writes — but the on-chain programs have no TypeScript SDK yet (M6). Without
a folder structure agreed on up front, route handlers tend to accumulate ad hoc `fetch`/RPC
calls with no separation between "what the route does" and "how we talk to Solana."

## Solution

Next.js App Router Route Handlers (`app/app/api/**`) that only ever call a `server/services/*`
function — never `Connection`/RPC directly. Services are the seam: they return fixture data
today and will decode real on-chain accounts once the M6 SDK exists, without any change to the
route handlers themselves.

```
app/
  app/api/
    health/route.ts              # liveness check
    markets/route.ts              # GET /api/markets
    markets/[marketId]/route.ts   # GET /api/markets/:marketId
  server/
    lib/
      env.ts                      # server-only env access, throws on missing required vars
      errors.ts                   # ApiError/NotFoundError -> HTTP status mapping
    solana/
      connection.ts               # shared Connection singleton
      programs.ts                 # deployed program IDs (mirrors Anchor.toml)
    services/
      market-service.ts           # listMarkets(), getMarket() — routes call only this
    types/
      market.ts                   # Market type, mirrors programs/market/src/state.rs
```

## Scope

- In: health check, list/get market endpoints (fixture data), the service/route separation,
  shared RPC connection, error-to-HTTP-status mapping.
- Out: real on-chain decoding (blocked on M6 SDK), writes/transactions, auth, caching,
  Pyth price fetching, rate limiting.

## Implementation notes

- `server/` holds anything that must not run in the browser; every file in it imports
  `server-only` so an accidental client import fails the build instead of leaking RPC URLs or
  future secrets into the bundle.
- `server/types/market.ts` intentionally mirrors `Market` in
  `programs/market/src/state.rs` field-for-field — keep them in sync manually until the IDL
  can generate this.
- `server/solana/programs.ts` copies the localnet program IDs from `Anchor.toml`. This will
  need per-cluster overrides (env-based) once a devnet/mainnet deployment exists — not built
  yet, since only localnet IDs exist today.
- Fixture data in `market-service.ts` is the market list/detail shape for the future app
  shell. Nothing in the UI consumes it yet: the landing page does not read `/api/markets`,
  so that route is currently exercised only by direct requests. See
  `docs/features/design-system.md`.

## Verification

- `npm run build` passes (typecheck + route registration: `/api/health`, `/api/markets` static,
  `/api/markets/[marketId]` dynamic).
- Manual `curl` pass against a local dev server: health check, list, get-by-id, and the 404 path
  for an unknown market ID all returned the expected status/body.
- Not verified: behavior against a real RPC endpoint (fixtures only), any load/latency
  characteristics, CORS/auth behavior.
