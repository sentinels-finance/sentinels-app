"use client";

import { createAppKit } from "@reown/appkit/react";
import type { ReactNode } from "react";
import { useRef } from "react";
import {
  appKitMetadata,
  REOWN_PROJECT_ID,
  solanaAdapter,
  solanaNetworks,
} from "@/lib/wallet/appkit-config";

let initialized = false;

function initAppKit() {
  if (initialized) return;
  if (!REOWN_PROJECT_ID) {
    console.warn(
      "NEXT_PUBLIC_REOWN_PROJECT_ID is not set — wallet connect will not work. " +
        "Get a project ID from https://cloud.reown.com and add it to .env.local.",
    );
  }
  createAppKit({
    adapters: [solanaAdapter],
    networks: solanaNetworks,
    metadata: appKitMetadata,
    projectId: REOWN_PROJECT_ID,
    themeMode: "dark",
    themeVariables: {
      "--apkt-accent": "#3b82f6",
      "--apkt-font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
  });
  initialized = true;
}

export function AppKitProvider({ children }: { children: ReactNode }) {
  const didInit = useRef(false);
  if (!didInit.current) {
    initAppKit();
    didInit.current = true;
  }
  return <>{children}</>;
}
