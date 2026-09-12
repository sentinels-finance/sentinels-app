# Devnet test tokens

**Status:** shipped
**Owner milestone:** `docs/features/app-backend-integration.md`

## Problem

`app/server/services/wallet-asset-service.ts` hardcodes the real mainnet mint addresses for
USDC, wBTC, and cbBTC to look up wallet balances and price/icon metadata. On devnet, a
connected wallet never holds tokens at those addresses — so every devnet wallet showed $0.00
USDC and 0 wBTC/cbBTC, making it impossible to exercise the Protect/Add-liquidity flows
end-to-end while testing `docs/features/app-backend-integration.md`. This surfaced while trying
to seed a devnet market: `scripts/seed-market.ts` failed with an on-chain `Unauthorized` error
because the devnet `GlobalConfig`'s actual admin key isn't available on this machine (a separate,
unresolved issue — tracked verbally, not blocking this fix).

## Solution

`scripts/create-devnet-test-tokens.ts` creates three throwaway SPL token mints on devnet (not
real USDC/wBTC/cbBTC — just tokens that behave the same way for testing) and mints an initial
supply to a given wallet:

```bash
ANCHOR_WALLET=~/.config/solana/id.json npx ts-node --transpile-only \
  scripts/create-devnet-test-tokens.ts --owner <wallet-to-receive-tokens> [--mint-more]
```

Idempotent — addresses are saved to `config/devnet-test-mints.json` and reused on re-run
instead of minting fresh tokens each time; pass `--mint-more` to top up the existing mints
instead.

`wallet-asset-service.ts` is now cluster-aware: `listWalletAssets(owner, cluster)` picks
`MAINNET_WRAPPED_BTC`/`MAINNET_USDC_MINTS` on mainnet and `DEVNET_WRAPPED_BTC`/
`DEVNET_USDC_MINTS` (sourced from `config/devnet-test-mints.json`) on devnet. The devnet wBTC/
cbBTC entries are labeled "(devnet test token)" in their display name so they're never
mistaken for the real thing in the UI.

## Scope

- In: devnet USDC/wBTC/cbBTC test mints, cluster-aware wallet-asset lookup.
- Out: minting a devnet test token that matches a *market's* actual `usdc_mint` — that still
  requires `create_market`/`seed-market.ts`, which is blocked on the missing devnet admin
  keypair. Once that's available, pass `--usdc-mint <config/devnet-test-mints.json:usdc>` to
  `seed-market.ts` so a newly created market's collateral is denominated in this same test
  USDC the wallet already holds.

## Implementation notes

- `scripts/create-devnet-test-tokens.ts` requires `--transpile-only` when run with `ts-node`:
  the root `tsconfig.json`'s `types: ["mocha", "chai"]` excludes `@types/node`, so this script's
  plain Node built-ins (`fs`/`path`/`os`/`process`) fail type-checking under plain `ts-node`
  even though they run fine — same constraint any other Node-builtin-using script here would
  hit; `scripts/seed-market.ts` avoids it by never importing `fs`/`path`/`os` directly.
- Mint authority is left with the payer (not revoked), so `--mint-more` can top up supply later
  — these are devnet test tokens with no real value, so there's no risk in an ongoing mint
  authority.
- Devnet mints created and minted to the wallet used for manual testing:
  `A99PEZWyKzjym7PTZXDWu4ztfC2urLEt1fBgb2vp1mdj` (USDC, 6 decimals, 1,000,000 minted),
  `5B469ubvaMdP4bumEu3uPSuJBW8YYWD6LCFJAhwiXtmg` (wBTC, 8 decimals, 100 minted),
  `5xYn2q9NRDpeKrEiWVN4EkryeJ4k4YUvzfPE8KGpwaJN` (cbBTC, 8 decimals, 100 minted) — see
  `config/devnet-test-mints.json` for the current values (re-run the script to mint more or to
  a different wallet).

## Verification

- `cd app && npx tsc --noEmit` and `npm run build` — clean.
- Ran `create-devnet-test-tokens.ts` against devnet, then reloaded the Market page with the
  same wallet connected: "Available balance: 1,000,000.00 USDC" now shows correctly (was
  $0.00 before), and the asset-selector dropdown lists cbBTC/WBTC labeled "(devnet test
  token)" with the minted balance.
- **Not verified**: using this USDC mint as an actual market's `usdc_mint` (blocked on the
  devnet admin-keypair issue, see Scope).
