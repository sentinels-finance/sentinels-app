"use client";

import { Transaction } from "@solana/web3.js";
import type { Provider } from "@reown/appkit-adapter-solana/react";
import { useAppKitConnection } from "@reown/appkit-adapter-solana/react";
import { useAppKitProvider } from "@reown/appkit/react";

export function deserializeUnsignedTx(base64: string): Transaction {
  return Transaction.from(Buffer.from(base64, "base64"));
}

export function useSendUnsignedTx() {
  const { connection } = useAppKitConnection();
  const { walletProvider } = useAppKitProvider<Provider>("solana");

  return async function sendUnsignedTx(base64: string): Promise<string> {
    if (!connection) throw new Error("No Solana connection available.");
    if (!walletProvider) throw new Error("No wallet connected.");

    const tx = deserializeUnsignedTx(base64);
    const signature = await walletProvider.sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");
    return signature;
  };
}
