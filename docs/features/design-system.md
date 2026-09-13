# Design system

**Status:** prototype
**Owner milestone:** `docs/product/planned/m7-frontend.md`

## Problem

The previous kit was a Stacks/shadcn library (DM Sans, `primary-1`…`neutrals-8`, Radix
primitives, a large atom/molecule inventory, and static `/connect` `/market` `/liquidity`
shells). The live Figma file is a Sentinels landing built on the Nexora token system
(Inter, `neutral/0`–`950`, semantic `bg/` `text/` `stroke/` roles). Those two systems
cannot coexist without duplicate tokens and leftover assets.

## Solution

The app design system is the Nexora collection used in
[Sentinels Figma](https://www.figma.com/design/SRB7qqYmcY29JA6GOzVugR/Sentinels):

- **Tailwind CSS** only (no CSS Modules, no shadcn/ui, no Radix primitives).
- **Atomic folders** for product UI: `atoms/` → `molecules/` → `organisms/`.
- Tokens are CSS RGB channels in `app/app/globals.css`, mapped in `app/tailwind.config.js`,
  so opacity modifiers like `bg-neutral-400/10` resolve.
- Font is Inter (`next/font/google` → `--font-inter`).
- Landing artwork lives in `app/public/landing/`.

The marketing landing ships on `/`. A static app shell (Nexora, mock data, no wallet or
SDK) lives on `/protect`, `/positions`, `/history`, and `/liquidity`. Live market data
and signing stay gated on M6.

## Folder map

```
app/components/
  atoms/        # Button, SectionTitle
  molecules/    # SectionHeader, AssetTile
  organisms/    # landing sections (nav, hero, features, benefits, ecosystem, CTA, footer)
app/lib/utils.ts          # cn() — clsx + tailwind-merge with Nexora font sizes
app/app/globals.css       # primitive RGB tokens
app/tailwind.config.js    # color / type / spacing / radius / shadow mapping
```

Import from `atoms/`, `molecules/`, and `organisms/` only.

## Tokens

Mirrored from Figma collections `01-Primitives`, `02-Tokens`, and `04-Spacing`.

| Tailwind | Figma / value |
| --- | --- |
| `neutral-0` … `neutral-950` | `neutral/0`–`950` (plus `50`, `100`) |
| `primary-400` … `primary-900` | `purple/400`–`900` via `base/primary-*` |
| `strong-950` | `bg/strong-950`, `text/strong-950` |
| `surface-800` / `surface-900` | `bg/surface-800`, `bg/surface-900` |
| `soft-300` / `soft-400` | `text/soft-300`, `text/soft-400` |
| `sub-500` | `text/sub-500` |
| `font-sans` | Inter |
| `text-h2`, `text-h3`, `text-h6` | Heading / H2 · H3 · H6 Semi Bold |
| `text-body-lg` … `text-body-xs` | Body Text Large → XSmall |
| `spacing-2xs` … `spacing-9xl` | 2 / 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 / 56 / 64 / 80 / 120 / 140 |
| `rounded-sm` … `rounded-2xl` | radius 8 / 12 / 16 / 20 / 24 |
| `shadow-button-primary` / `neutral` / `secondary` | Button/Default/* effect styles |

## Component inventory

**Atoms:** `Button` (`href` required; variants `primary` \| `neutral` \| `secondary`; sizes
`sm` \| `md`), `SectionTitle`.

**Molecules:** `SectionHeader`, `AssetTile`.

**Organisms:** `SiteNav`, `HomeHero`, `Features`, `Benefits`, `Ecosystem`, `Cta`,
`SiteFooter`.

## Deliberate deviations from Figma

All buyer-facing copy follows the product-framing rule in `docs/PRD.md`: coverage language
only, no DOWN/UP tokens or mint/swap mechanics.

## Implementation notes

- Lives in `app/` (Next.js App Router, TypeScript).
- `cn()` is the only class combiner. Custom font-size names are registered with
  `extendTailwindMerge` so they do not collide with `text-*` colors.
- Do not add `.module.css` files or a component gallery unless asked.

## Verification

- `npm run build` in `app/` (typecheck + static generation).
- Route: `/` (landing).
- Landing checked at 1440 against the Figma Navigation Bar and page frame.
