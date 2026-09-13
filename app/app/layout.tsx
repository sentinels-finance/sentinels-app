import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppKitProvider } from "@/components/providers/appkit-provider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Sentinels — On-chain price insurance",
  description:
    "Sentinels is a parametric price-insurance market for BTC, ETH, and SOL, fully collateralized in USDC and settled by the Pyth oracle.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <AppKitProvider>{children}</AppKitProvider>
      </body>
    </html>
  );
}
