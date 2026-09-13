"use client";

import { usePathname } from "next/navigation";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { Button } from "@/components/atoms/button";
import { truncateAddress } from "@/lib/app-format";
import { parseWalletAddress } from "@/lib/wallet/assets";

const links = [
  { label: "Protect", href: "/protect" },
  { label: "Positions", href: "/positions" },
  { label: "History", href: "/history" },
  { label: "Liquidity Pool", href: "/liquidity" },
  { label: "Docs", href: "#" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-center px-4 pt-12 md:px-9xl">
      <nav className="pointer-events-auto flex h-14 w-full max-w-[1160px] items-center gap-3xl overflow-clip rounded-lg bg-neutral-400/10 p-sm shadow-[inset_0_0_0_1px_rgb(153_160_174/0.1)] backdrop-blur-[28px]">
        <div className="flex h-8 w-[99px] shrink-0 flex-col items-start pl-sm">
          <a href="/protect" className="flex h-8 w-[91px] items-center gap-1.5">
            <span className="relative size-6 shrink-0 overflow-clip">
              <span className="absolute inset-y-0 left-[12.57%] right-[14.13%]">
                <img
                  alt=""
                  src="/landing/mark.svg"
                  className="absolute inset-0 block h-6 w-[17.592px] max-w-none"
                />
              </span>
            </span>
            <span className="whitespace-nowrap text-body-lg font-semibold text-white">Sentinels</span>
          </a>
        </div>
        <div className="hidden min-w-px flex-1 items-center justify-center gap-3xl md:flex">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className="flex h-6 items-center justify-center gap-1 whitespace-nowrap text-body-sm font-medium text-white"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex h-10 w-[99px] shrink-0 flex-col items-end md:ml-0">
          <Button
            variant="secondary"
            size="sm"
            className="w-[132px]"
            onClick={() => open({ view: isConnected ? "Account" : "Connect" })}
          >
            {isConnected && address ? truncateAddress(parseWalletAddress(address)) : "Connect Wallet"}
          </Button>
        </div>
      </nav>
    </header>
  );
}
