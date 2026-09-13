# PRD — Sentinels Phase 1 (MVP)

## Goal

Prove that the core Sentinels mechanism — a fully-collateralized binary market resolved
parametrically from a price oracle — works safely on Solana, with the smallest scope that is
still end-to-end (open a position → trade → resolve → redeem).

## Product framing — insurance, not a prediction market

The mechanism is a binary DOWN/UP market; the *product* is downside insurance. Both statements
are true and they must not be collapsed into one another:

- **Mechanism (this document, `ARCHITECTURE.md`, `PROGRAM_SPEC.md`).** Complete DOWN + UP sets
  are minted 1:1 against USDC and both tokens exist — the 1:1 collateral invariant depends on
  it. Describe this plainly in technical docs.
- **Product.** A buyer only ever ends up holding DOWN. The UP side is the underwriter's, taken
  by liquidity providers (see `product/personas.md`). Nobody is sold a bet on the price going
  up.

**Rule for anything a buyer reads** — UI copy, marketing, the Figma file: describe it as
coverage (deposit, coverage amount, expiry, strike, premium, payout). Do not surface DOWN/UP
tokens, "complete sets", "mint and swap", "pick a side", or any other prediction-market
framing; those are implementation details. LP-facing surfaces are the exception — underwriters
need the UP-side risk stated explicitly.

## Target users (MVP)

- BTC/ETH/SOL holders who want short-term (weekly) price protection.
- Liquidity providers willing to supply the AMM pool and earn fees in exchange for taking on
  the UP-side risk.

The MVP does not target institutional users or high volume — the point is mechanism
correctness, not scale.

## Scope IN (Phase 1)

- Three assets: BTC, ETH, SOL. One Pyth feed per asset.
- Strike and expiry are set by the admin at `create_market` (not user-generated). Fixed
  weekly expiry (e.g. every Friday 00:00 UTC).
- Mint/merge complete sets (DOWN + UP) 1:1 against USDC.
- One LMSR AMM pool per market for price discovery and DOWN/UP swaps.
- Liquidity providing directly into the AMM pool (add/remove liquidity) — this is what
  "underwriting" means in the MVP.
- Permissionless resolution via a keeper calling `resolve_market` with a Pyth price update.
- Post-resolution redemption (burn the winning token → USDC).
- A single admin authority (not a DAO) for `create_market` and `RiskConfig`, behind a minimal
  timelock.

## Scope OUT (deferred to Phase 2/3, see IMPLEMENTATION_PLAN.md)

- Frontend application flows. Only low-fidelity wireframes exist for these at this stage (see
  the delivered wireframe file) — no working UI for market list / Protect / redeem /
  provide-liquidity is built during the MVP program-implementation phase. Program interaction
  happens via the Anchor TypeScript client / CLI / tests. (`app/` holds a design system and a
  landing page — not wired to the chain — see `docs/features/design-system.md` and
  `docs/product/planned/m7-frontend.md`.)
- CLOB / order matching for large sizes — MVP is LMSR-only.
- Automated Underwriting Vault with cross-market allocation.
- Insurance Backstop Fund.
- DAO governance and a $SNTL token.
- Multi-strike strips (graduated payout) — MVP is one strike per market.
- RWA / cross-chain assets.
- User-generated markets (custom strike/expiry by end users).

## Functional requirements

1. Admin can create a new market: choose asset feed, strike (basis points below the price at
   creation time), expiry timestamp.
2. A user can deposit USDC to mint a complete set (DOWN + UP), then sell one side into the AMM
   pool to get one-directional exposure (e.g. holding only DOWN = buying protection).
3. A user can swap DOWN↔UP↔USDC directly through the AMM pool without a manual mint step (UX:
   a single "Protect" action).
4. A user can provide liquidity to the AMM pool and withdraw it before expiry.
5. Anyone (a keeper) can trigger `resolve_market` once expiry has passed, earning a small
   fixed incentive paid from the vault.
6. After resolution, holders of the winning token can redeem to USDC at any time (no claim
   deadline in the MVP).
7. Trading halts automatically during a short window before expiry (`trading_halt_secs` in
   `RiskConfig`).

## Non-functional requirements

- Every instruction ships with an Anchor test (happy path + at least 2 failure paths).
- No instruction may leave the collateral vault short of funds for a valid redemption (see the
  1:1 collateral invariant in `CLAUDE.md`).
- Internal audit (the self-review checklist in `docs/libs/PROGRAM_SPEC.md`) before deploying to
  public devnet; an external audit is required before any real funds touch mainnet — out of
  scope for this implementation plan, but a hard prerequisite.

## Definition of done for the MVP

- A full cycle runs on devnet: create_market → mint complete set → swap on the AMM →
  add/remove liquidity → automatic trading halt → resolve_market using a real Pyth devnet
  price → redemption succeeds for the winning side and reverts for the losing side.
- The full Anchor test suite passes, including constraint-violation tests.
- The entire flow above can be exercised through the TypeScript client/CLI without a working
  frontend — a frontend is not required to consider the MVP done.