# Sentinels — Context for Claude Code

Sentinels is a Solana dApp: a binary prediction market (DOWN/UP) framed as a price-insurance
product for major crypto assets (BTC, ETH, SOL in the MVP phase). Every position is 100%
collateralized in USDC — no synthetic leverage, no protocol default risk. Market resolution is
purely parametric, driven by the Pyth price oracle, with no manual claims process.

The mechanism is a binary DOWN/UP market, but the product is insurance: a buyer only ever holds
DOWN, and the UP side belongs to liquidity providers. Anything a buyer reads talks about
coverage, never about DOWN/UP tokens, complete sets or picking a side — see the product-framing
rule in `docs/PRD.md`.

Read in this order before starting work:
1. `docs/PRD.md` — MVP scope, what is IN and OUT.
2. `docs/architecture/ARCHITECTURE.md` — system overview and the reasoning behind it. The fuller
   product/investor-facing architecture lives in the Sentinels artifact:
   https://claude.ai/code/artifact/9a840625-bf4d-4189-b327-57781a546a1b
3. `docs/libs/PROGRAM_SPEC.md` — accounts, instructions, and invariants for every program. This
   is the source of truth for implementation.
4. `docs/IMPLEMENTATION_PLAN.md` — the order of work. Follow it in sequence; don't start the
   AMM before `market_program` passes its tests. Each milestone links to a detail file under
   `docs/product/implemented/` or `docs/product/planned/` — that's where status, scope, and
   test coverage per milestone live; keep both in sync when a milestone's status changes.

See `docs/README.md` for the full doc map, including `docs/features/` (UI/product features that
aren't program milestones) and `docs/product/personas.md`.

## Tech stack

- On-chain: Rust + the Anchor framework.
- Oracle: Pyth Network pull oracle (`pyth-solana-receiver` / `pyth-sdk-solana`), devnet feed
  IDs for BTC/USD, ETH/USD, SOL/USD.
- Client/testing: `@coral-xyz/anchor` TypeScript client, Anchor's Mocha/Chai test harness,
  `solana-program-test` / `bankrun` for fast unit tests outside a local validator.

Frontend application flows (market list, Protect, positions/redeem, provide-liquidity) are out
of scope until `docs/product/planned/m7-frontend.md` is unblocked by M6 (the TypeScript SDK) —
see `docs/PRD.md`. Ahead of that sequencing, `app/` holds a Tailwind design system (Nexora
tokens, atomic folders, no CSS Modules) and a landing page on `/` — no wallet connection, SDK
integration, or live market data; see `docs/features/design-system.md`. Don't wire `app/` into
the gated application flows without the user explicitly asking.

## Suggested repo layout

```
programs/
  config/           # admin authority, pause flag, risk params
  market/           # market factory + collateral vault (mint/merge/redeem)
  amm/               # LMSR pricing pool per market
  resolution/        # reads Pyth, determines outcome
tests/
  <same name as program>.ts
app/                 # Next.js frontend package (design system + empty home — see Tech stack)
docs/
  architecture/       # system design
  libs/                # PROGRAM_SPEC.md, API.md — implementation source of truth
  product/
    implemented/        # one file per shipped milestone
    planned/             # one file per upcoming milestone
    personas.md
  features/            # UI/product features that aren't program milestones
```

## Invariants that must never be broken

These are not suggestions — they are hard limits. Any change touching one of the programs
above must preserve the following, and every commit/PR touching it must include a test that
proves it:

- **1:1 collateral.** The total USDC held in a market's vault must always equal the DOWN
  supply and the UP supply for that market (they are always equal to each other, because every
  mint always creates a pair). No instruction may mint DOWN/UP without locking the matching
  USDC in the same atomic instruction.
- **No one-sided minting.** `down_mint` and `up_mint` authority must be a program PDA, never a
  wallet. There is no path to mint one side without its pair, except redemption after
  resolution (which burns, never mints).
- **Resolution is permanent.** Once `Market.outcome` is set (Down/Up), no instruction may
  change it again. There is no "un-resolve."
- **Resolution only from a valid oracle price.** `resolve_market` must reject (revert) any
  Pyth data older than `max_staleness_secs`, or whose confidence interval exceeds
  `max_confidence_bps`. Never fall back to a default or a manually cached price.
- **LMSR bounded loss.** The liquidity parameter `b` on an AMM pool determines that pool's
  maximum loss per market. Changing `b` after a pool is live must be rejected — `b` is locked
  at `init_pool`.
- **Governance timelock.** Any change to `RiskConfig` (fees, staleness threshold, new assets)
  through `config_program` must go through a timelock, even in the admin-multisig phase (not
  yet a DAO). No admin instruction should take effect with zero delay.

## Expected way of working

- Every new instruction in `programs/*` ships with an Anchor test covering both the success
  path and failure paths (constraint violations, staleness, unauthorized signer).
- Do not implement an automated Underwriting Vault, an Insurance Backstop Fund, or DAO
  governance in the early iterations — those are Phase 2/3 in `IMPLEMENTATION_PLAN.md`. For
  the MVP, underwriting happens directly through `add_liquidity` on `amm_program`.
- If this document and `docs/libs/PROGRAM_SPEC.md` disagree, `PROGRAM_SPEC.md` wins — this file
  is a summary, not the full specification.