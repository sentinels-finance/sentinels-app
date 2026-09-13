# IMPLEMENTATION_PLAN — Sentinels

Work through this in order. Don't start the next milestone before the previous one's tests are
green — each program genuinely depends on the one before it (e.g. `amm_program` needs valid
`down_mint`/`up_mint` accounts from `market_program`).

This file is the sequencing source of truth. Per-milestone detail (what/why/scope/test
coverage) lives in `docs/product/implemented/` or `docs/product/planned/` — update both when a
milestone's status changes.

## Phase 1 — MVP (full scope in `PRD.md`)

### M0 — Scaffolding — [`implemented`](product/implemented/m0-scaffolding.md)
- [x] Initialize the Anchor workspace, 4 empty programs matching the layout in `CLAUDE.md`.
- [ ] Set up `solana-program-test` / `bankrun` for fast unit tests.
- [x] Record devnet Pyth feed IDs in `config/pyth-feeds.json`.
- [x] Minimal CI: `anchor build` + `anchor test` on every push.

### M1 — `config_program` — [`implemented`](product/implemented/m1-config-program.md)
- [x] `GlobalConfig`, `RiskConfig`, every instruction from `docs/libs/PROGRAM_SPEC.md` §1.
- [x] Tests: initialize, set_paused, upsert_risk_config, two-step admin transfer, wrong-signer
      rejection.

### M2 — `market_program` — [`implemented`](product/implemented/m2-market-program.md)
- [x] `create_market`, `mint_complete_set`, `merge_complete_set`, `redeem` per
      `docs/libs/PROGRAM_SPEC.md` §2.
- [x] Test the 1:1 collateral invariant after a mint → merge → mint sequence.
- [x] Test `create_market` rejected when `RiskConfig` for that asset is missing/disabled.
- [x] Test `mint_complete_set` rejected inside `trading_halt_secs`.

### M3 — `amm_program` — [`implemented`](product/implemented/m3-amm-program.md)
- [x] Fixed-point LMSR math as a pure module, unit-tested with no Solana runtime.
- [x] `init_pool`, `add_liquidity`, `remove_liquidity`, `swap` per `docs/libs/PROGRAM_SPEC.md` §3.
- [x] Test bounded loss against the theoretical LMSR bound.
- [x] Test slippage protection (`min_amount_out`) and correct fee deduction.

### M4 — `resolution_program` — [`implemented`](product/implemented/m4-resolution-program.md)
- [x] Integrate `pyth-solana-receiver`/`pyth-sdk-solana`, verifying a genuine Pyth account.
- [x] `resolve_market` per `docs/libs/PROGRAM_SPEC.md` §4.
- [x] Test staleness, confidence-interval rejection, double-resolution.
- [x] Test post-resolution redemption for winning side, rejection for losing side.

### M5 — End-to-end integration — [`implemented`, one item outstanding](product/implemented/m5-e2e-integration.md)
- [x] Full localnet scenario — see `tests/e2e.ts`.
- [ ] Repeat the same scenario on real devnet with real devnet Pyth feeds (not simulated).

### M6 — TypeScript SDK — [`planned`](product/planned/m6-typescript-sdk.md)
- [ ] Client wrapper over the Anchor IDL: `protectAsset`, `provideLiquidity`, `redeem`.
- [ ] Unit-test the SDK against localnet.

### M7 — Frontend — [`planned`, design system + static UI built](product/planned/m7-frontend.md)

Originally deferred pending M6 — interacting with the protocol during Phase 1 was meant to
happen through the SDK, the CLI, and tests, not a UI. A Tailwind design system (Nexora tokens)
and a landing page on `/` have been built ahead of that sequencing, with no wallet/SDK
integration — see `docs/features/design-system.md`. The behaviour behind the rest of M7
(market list, Protect flow, positions/redeem, provide-liquidity) stays gated on M6.

### M8 — Before any mainnet conversation — [`planned`](product/planned/m8-mainnet-readiness.md)
- [ ] Run the full self-review checklist in `docs/libs/PROGRAM_SPEC.md`.
- [ ] Replace the single `admin` key with a multisig (e.g. Squads).
- [ ] Independent external audit.

---

## Phase 2 (after the MVP is proven on devnet) — [`planned`](product/planned/phase-2.md)

- Automated Underwriting Vault (cross-market allocation, per-asset exposure limits).
- Insurance Backstop Fund funded from a share of fees.
- CLOB / order matching for large sizes, alongside the LMSR pool.
- Multi-strike strips per asset (graduated payout, approximating a put-option curve).
- Switchboard as a second oracle cross-check.
- Governance transition to a DAO ($SNTL token, staking as backstop capital).
- Full frontend build (beyond the M7 design system), using the wireframes from Phase 1.

## Phase 3 — [`planned`](product/planned/phase-3.md)

- RWA / off-chain assets with third-party oracle attestation.
- Cross-chain integration (e.g. via Wormhole).

Design rationale for each phase lives in `docs/architecture/ARCHITECTURE.md` and the product
design document (the [Sentinels architecture artifact](https://claude.ai/code/artifact/9a840625-bf4d-4189-b327-57781a546a1b))
— this file is only the technical work order.
