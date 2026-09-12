# App-backend integration

**Status:** in progress
**Owner milestone:** `docs/product/planned/m7-frontend.md`

## Problem

`app/`'s Market and Liquidity pages were static UI shells (per `docs/features/design-system.md`):
hardcoded mock arrays for positions/history/pools, a made-up premium-rate constant for quotes,
and a confirm-transaction modal whose "Confirm" button just closed itself — no call to any API,
no transaction ever built or signed. Meanwhile `app/server/*` + `app/app/api/*` already had a
complete, working backend (real on-chain reads for markets/pools/positions/wallet assets, plus
unsigned-transaction builders for every program instruction) that nothing in the UI called.

## Solution

Wire the existing UI to the existing backend — no new API routes, no changes to
`programs/*` or `app/server/*` (that layer was already correct).

- **Read side**: `app/lib/api/{markets,pool,positions}.ts` — thin `fetch` wrappers over
  `GET /api/markets`, `GET /api/markets/[marketId]/pool`, `GET /api/users/[wallet]/positions`,
  mirroring the existing `app/lib/wallet/assets.ts` idiom (plain `fetch`, manual type
  assertion, throw on non-ok).
- **Write side**: `app/lib/api/tx.ts` wraps every `/api/tx/*` route (`protect`, `mint`, `merge`,
  `swap`, `redeem`, `add-liquidity`, `remove-liquidity`), each returning the backend's unsigned,
  base64-encoded legacy `Transaction`.
- **Signing**: `app/lib/wallet/send-transaction.ts` exposes `useSendUnsignedTx()`, a hook that
  deserializes that base64 string, signs it via the connected wallet (Reown AppKit's Solana
  provider), submits it, and waits for confirmation. This is the piece that didn't exist at all
  before — nothing in the app could take a built transaction and actually get it signed.
- **Pages**: `app/app/market/page.tsx` and `app/components/organisms/liquidity-pool-flow.tsx`
  now fetch real markets/pools/positions instead of mock arrays, compute quotes from the pool's
  live `priceDown`/`priceUp` instead of a fabricated rate, and their confirm modals call
  build-tx → sign+send → refetch instead of just closing.

## Scope

- In: Market page (Protect quote, Buy-coverage flow, Positions tab, History tab, Redeem for
  resolved winning positions), Liquidity page (pool list, Add/Remove liquidity, My Position).
- Out: mint/merge/swap UI (no existing page has controls for these — only the flows the
  current UI shells already exposed got wired), a dedicated quote API endpoint (quotes are
  derived client-side from `Pool.priceDown`/`priceUp`), APR/analytics (the AMM pool doesn't
  track accrued fees — the pool's real `feeBps` rate is shown instead of a fabricated APR).

## Implementation notes

- New files: `app/lib/api/{markets,pool,positions,tx}.ts`, `app/lib/wallet/send-transaction.ts`.
- Modified: `app/app/market/page.tsx`, `app/components/organisms/liquidity-pool-flow.tsx`.
- Liquidity's `AddPanel` previously collected one deposit amount; since `add_liquidity` needs
  equal DOWN and UP amounts (see `docs/libs/API.md`), that single input is now split 50/50
  before building the transaction — the mock UI never had two amount fields to begin with.
- `feature/apps-integration` branch, shipped as
  [nashirjamali/sentinel-sol#9](https://github.com/nashirjamali/sentinel-sol/pull/9).

## Verification

- `cd app && npx tsc --noEmit` and `npm run build` — clean.
- Manual pass against devnet with a real connected wallet (Phantom): verified live data
  end-to-end — wallet assets, active/resolved market list, Positions/History tabs, and the
  Liquidity page's empty-pool state all reflect genuine on-chain state, including the correct
  disabled/empty states when no active market or pool exists.
- **Not verified**: the full Buy-coverage / Add-liquidity / Redeem transaction flow end-to-end
  (sign → submit → confirm → balance update). Blocked on devnet currently having no active
  market with a live AMM pool to test against — see `docs/features/devnet-test-tokens.md` for
  the unrelated admin-keypair issue this surfaced.
