async function postTx(path: string, body: Record<string, string>): Promise<string> {
  const response = await fetch(`/api/tx/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Couldn't build the transaction.");
  }
  const payload = (await response.json()) as { transaction: string };
  return payload.transaction;
}

export function buildProtectTx(params: {
  market: string;
  amount: string;
  minDownOut: string;
  wallet: string;
}): Promise<string> {
  return postTx("protect", params);
}

export function buildMintTx(params: {
  market: string;
  amount: string;
  wallet: string;
}): Promise<string> {
  return postTx("mint", params);
}

export function buildMergeTx(params: {
  market: string;
  amount: string;
  wallet: string;
}): Promise<string> {
  return postTx("merge", params);
}

export function buildSwapTx(params: {
  market: string;
  sideIn: "down" | "up";
  amountIn: string;
  minAmountOut: string;
  wallet: string;
}): Promise<string> {
  return postTx("swap", params);
}

export function buildRedeemTx(params: {
  market: string;
  amount: string;
  wallet: string;
}): Promise<string> {
  return postTx("redeem", params);
}

export function buildAddLiquidityTx(params: {
  market: string;
  usdcAmount: string;
  wallet: string;
}): Promise<string> {
  return postTx("add-liquidity", params);
}

export function buildRemoveLiquidityTx(params: {
  market: string;
  lpAmount: string;
  wallet: string;
}): Promise<string> {
  return postTx("remove-liquidity", params);
}
