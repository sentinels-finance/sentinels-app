import type { Market } from "@/lib/api/markets";
import type { TokenSymbol } from "@/components/atoms/token-logo";
import type { SolanaCluster } from "@/lib/wallet/assets";

export const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_DECIMALS = 6;
export const PYTH_PRICE_DECIMALS = 8;
export const PROTECT_SLIPPAGE_BPS = 100;

export function formatUsd(value: number, digits = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function usd(value: number, digits = 2) {
  return `$${formatUsd(value, digits)}`;
}

export function formatTokenAmount(value: number) {
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function parseAmount(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === ".") return null;
  const next = Number(cleaned);
  if (!Number.isFinite(next) || next < 0) return null;
  return next;
}

export function maxAmountFor(price: number, usdcBalance: number) {
  if (!(price > 0)) return 0;
  return Math.floor((usdcBalance / price) * 100) / 100;
}

export function clusterFromNetwork(networkId: string | undefined): SolanaCluster {
  if (!networkId) {
    return process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet" ? "mainnet" : "devnet";
  }
  if (networkId.includes("EtWTRABZaYq6iMfeYKouRu166VU2xqa1") || networkId.includes("devnet")) {
    return "devnet";
  }
  return "mainnet";
}

export function toBaseUnits(uiAmount: number, decimals = USDC_DECIMALS): string {
  return Math.max(0, Math.round(uiAmount * 10 ** decimals)).toString();
}

export function fromBaseUnits(raw: string, decimals = USDC_DECIMALS): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return value / 10 ** decimals;
}

export function marketAssetForSymbol(symbol: string | undefined): Market["assetSymbol"] | null {
  if (symbol === "SOL") return "SOL";
  if (symbol === "cbBTC" || symbol === "WBTC" || symbol === "BTC") return "BTC";
  if (symbol === "ETH") return "ETH";
  return null;
}

export function daysUntil(expiryTs: number): number {
  const now = Date.now() / 1000;
  return Math.max(0, Math.round((expiryTs - now) / 86400));
}

export function expiryLabel(expiryTs: number): string {
  const days = daysUntil(expiryTs);
  return days <= 1 ? "1 day" : `${days} days`;
}

export function formatStrike(strikePrice: string): string {
  return usd(fromBaseUnits(strikePrice, PYTH_PRICE_DECIMALS));
}

export function nameFor(symbol: string): string {
  if (symbol === "SOL") return "Solana";
  if (symbol === "BTC" || symbol === "cbBTC" || symbol === "WBTC") return "Bitcoin";
  if (symbol === "ETH") return "Ethereum";
  return symbol;
}

export function tokenLogoSymbol(symbol: string): TokenSymbol {
  const upper = symbol.toUpperCase();
  if (upper === "ETH") return "ETH";
  if (upper === "BTC" || upper === "CBBTC" || upper === "WBTC") return "BTC";
  return "SOL";
}

export function truncateAddress(raw: string) {
  if (raw.length <= 10) return raw;
  return `${raw.slice(0, 4)}…${raw.slice(-4)}`;
}
