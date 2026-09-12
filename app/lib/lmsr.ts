// Client-side mirror of programs/amm/src/lmsr.rs's `swap_amount_out` + `apply_fee` — needed so
// the Protect quote's `minDownOut` slippage floor is set against the AMM's actual LMSR price
// impact, not a naive priceDown/priceUp ratio (which only holds for an infinitesimally small
// trade; anything sized relative to `b` gets materially less out than that ratio implies).
// Ordinary floating point is fine here — this only sets a slippage tolerance, it doesn't need
// to bit-match the program's fixed-point arithmetic.

export type LmsrSide = "down" | "up";

/** All amounts are in base units (e.g. USDC's 6-decimal units), matching `Pool.qDown/qUp/b`. */
export function lmsrSwapAmountOut(
  qDown: number,
  qUp: number,
  b: number,
  sideIn: LmsrSide,
  amountIn: number,
): number {
  if (b <= 0 || amountIn <= 0) return 0;
  const eDown = Math.exp(qDown / b);
  const eUp = Math.exp(qUp / b);
  const targetSum = eDown + eUp;

  const [qIn, qOut] = sideIn === "down" ? [qDown, qUp] : [qUp, qDown];
  const qInNew = qIn - amountIn;
  const eInNew = Math.exp(qInNew / b);
  const eOutNew = targetSum - eInNew;
  if (eOutNew <= 0) return 0;

  const qOutNew = b * Math.log(eOutNew);
  return Math.max(0, qOutNew - qOut);
}

export function applyLmsrFee(grossAmountOut: number, feeBps: number): number {
  return (grossAmountOut * (10_000 - feeBps)) / 10_000;
}
