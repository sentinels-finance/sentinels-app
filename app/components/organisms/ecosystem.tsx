import { AssetTile } from "@/components/molecules/asset-tile";
import { SectionHeader } from "@/components/molecules/section-header";

const live = [
  { ticker: "BTC", logo: "/landing/coin-btc.svg" },
  { ticker: "SOL", logo: "/landing/coin-sol.svg" },
  { ticker: "USDC", logo: "/landing/coin-usdc.svg" },
];

const soonSolana = [
  { ticker: "JUP", logo: "/landing/coin-jup.png" },
  { ticker: "PYTH", logo: "/landing/coin-pyth.png" },
  { ticker: "JTO", logo: "/landing/coin-jto.png" },
  { ticker: "RAY", logo: "/landing/coin-ray.png" },
  { ticker: "BONK", logo: "/landing/coin-bonk.png" },
  { ticker: "WIF", logo: "/landing/coin-wif.png" },
  { ticker: "ORCA", logo: "/landing/coin-orca.png" },
];

const soonStocks = [
  { ticker: "AAPL", logo: "/landing/stock-aapl.svg" },
  { ticker: "TSLA", logo: "/landing/stock-tsla.svg" },
  { ticker: "NVDA", logo: "/landing/stock-nvda.svg" },
  { ticker: "MSFT", logo: "/landing/stock-msft.svg" },
  { ticker: "AMZN", logo: "/landing/stock-amzn.svg" },
  { ticker: "GOOGL", logo: "/landing/stock-googl.svg" },
  { ticker: "META", logo: "/landing/stock-meta.svg" },
];

function Placeholders({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="size-[72px] shrink-0 rounded-md bg-neutral-800 opacity-20" />
      ))}
    </>
  );
}

export function Ecosystem() {
  return (
    <section className="flex flex-col items-center gap-6xl bg-strong-950 px-4 py-8xl md:px-9xl">
      <div className="w-full max-w-[1160px]">
        <SectionHeader
          badgeIcon="/landing/git-pull-request.svg"
          badge="Ecosystem"
          title="Built on Solana, Priced by Pyth"
          description="Real-time price feeds and on-chain settlement — no manual intervention required."
        />
      </div>
      <div className="relative flex w-full max-w-[1160px] flex-col items-center gap-6 overflow-clip">
        <div className="flex items-center justify-center gap-6">
          <Placeholders count={2} />
          {live.map((asset) => (
            <AssetTile key={asset.ticker} status="live" logo={asset.logo} ticker={asset.ticker} />
          ))}
          {soonSolana.slice(0, 5).map((asset) => (
            <AssetTile key={asset.ticker} status="soon" logo={asset.logo} ticker={asset.ticker} />
          ))}
          <Placeholders count={2} />
        </div>
        <div className="flex items-center justify-center gap-6">
          <Placeholders count={2} />
          {soonSolana.slice(5).map((asset) => (
            <AssetTile key={asset.ticker} status="soon" logo={asset.logo} ticker={asset.ticker} />
          ))}
          {soonStocks.map((asset) => (
            <AssetTile key={asset.ticker} status="soon" logo={asset.logo} ticker={asset.ticker} />
          ))}
          <Placeholders count={2} />
        </div>
        <div className="absolute inset-y-0 left-0 w-[100px] bg-gradient-to-r from-strong-950 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-[100px] bg-gradient-to-l from-strong-950 to-transparent" />
      </div>
      <p className="text-center text-base font-medium text-[#a1a8b8]">More assets incoming</p>
    </section>
  );
}
