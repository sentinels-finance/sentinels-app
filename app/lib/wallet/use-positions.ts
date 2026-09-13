"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { fetchMarkets, type Market } from "@/lib/api/markets";
import { fetchPositions, type Position } from "@/lib/api/positions";
import { parseWalletAddress } from "@/lib/wallet/assets";

export function usePositionsWithMarkets(refreshKey: number) {
  const { address } = useAppKitAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setPositions([]);
      setMarkets([]);
      setLoading(false);
      return;
    }
    const owner = parseWalletAddress(address);
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchPositions(owner), fetchMarkets()])
      .then(([positionsData, marketsData]) => {
        if (cancelled) return;
        setPositions(positionsData);
        setMarkets(marketsData);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load positions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey]);

  const marketByAddress = useMemo(() => {
    const map = new Map<string, Market>();
    markets.forEach((market) => map.set(market.address, market));
    return map;
  }, [markets]);

  return { positions, marketByAddress, loading, error, connected: Boolean(address) };
}
