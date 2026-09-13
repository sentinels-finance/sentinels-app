import { SectionHeader } from "@/components/molecules/section-header";
import { cn } from "@/lib/utils";

const benefits = [
  {
    icon: "/landing/icon-shield.svg",
    title: "Three Assets, One Vault",
    description:
      "Cover BTC, ETH, and SOL price drops from a single on-chain vault — no juggling separate policies.",
  },
  {
    icon: "/landing/icon-calendar.svg",
    title: "Weekly Coverage Windows",
    description:
      "Fixed weekly expiries keep pricing simple and predictable, with an automatic trading halt before settlement.",
  },
  {
    icon: "/landing/icon-coins-swap.svg",
    title: "Backed by Real Liquidity",
    description:
      "Liquidity providers underwrite every policy directly in the AMM pool, earning fees for taking on the risk.",
  },
];

const glassPanel = "absolute rounded-[7px] bg-white/[0.04] backdrop-blur-[6px]";

function BenefitsGraphic() {
  return (
    <div className="relative h-[620px] w-[564px] shrink-0 overflow-clip rounded-2xl bg-strong-950">
      <img alt="" src="/landing/benefits-glow.svg" className="absolute left-1/2 top-1/2 size-[647px] max-w-none -translate-x-1/2 -translate-y-1/2" />

      <div className="absolute left-1/2 top-12 flex -translate-x-1/2 gap-8">
        {[0, 1, 2].map((i) => (
          <img key={i} alt="" src={`/landing/benefits-ornament-${i}.svg`} className="size-[72px]" />
        ))}
      </div>
      <div className="absolute left-1/2 top-[500px] flex -translate-x-1/2 gap-8">
        {[3, 4, 5].map((i) => (
          <img key={i} alt="" src={`/landing/benefits-ornament-${i}.svg`} className="size-[72px]" />
        ))}
      </div>

      {/* Connectors: ornament rows ↔ dashboard window. */}
      <img alt="" src="/landing/benefits-vector-8425.svg" className="absolute left-[281px] top-[120px] h-[85px] w-[106px] max-w-none" />
      <img alt="" src="/landing/benefits-vector-8426.svg" className="absolute left-[177px] top-[120px] h-[85px] w-[106px] max-w-none -scale-x-100" />
      <img alt="" src="/landing/benefits-line-40.svg" className="absolute left-[280px] top-[120px] h-[66px] w-[2px] max-w-none" />
      <img alt="" src="/landing/benefits-vector-8427.svg" className="absolute left-[281px] top-[415px] h-[85px] w-[106px] max-w-none -scale-y-100" />
      <img alt="" src="/landing/benefits-vector-8426.svg" className="absolute left-[177px] top-[415px] h-[85px] w-[106px] max-w-none rotate-180" />
      <img alt="" src="/landing/benefits-line-41.svg" className="absolute left-[280px] top-[434px] h-[66px] w-[2px] max-w-none" />

      <div className="absolute left-1/2 top-1/2 h-[267px] w-[376px] -translate-x-1/2 -translate-y-1/2 overflow-clip rounded-[5px] border-2 border-neutral-700 bg-[linear-gradient(180deg,rgba(59,130,246,0.2),rgba(59,130,246,0)),linear-gradient(var(--neutral-950),var(--neutral-950))]">
        <div className="absolute -left-0.5 -top-0.5 h-[267px] w-[67px] bg-white/[0.04] backdrop-blur-[6px]" />
        <div className={cn(glassPanel, "left-[75px] top-2 h-[50px] w-[288px]")} />
        <div className="absolute left-[75px] top-[68px] flex w-[288px] gap-2.5">
          <div className="h-[49px] w-[82px] rounded-[7px] bg-white/[0.04] backdrop-blur-[6px]" />
          <div className="h-[50px] flex-1 rounded-[7px] bg-white/[0.04] backdrop-blur-[6px]" />
        </div>
        <div className={cn(glassPanel, "left-[75px] top-[128px] h-[153px] w-[288px]")} />
        <img alt="" src="/landing/benefits-window-dots.svg" className="absolute left-0.5 top-0.5 h-1 w-4" />
      </div>
    </div>
  );
}

export function Benefits() {
  return (
    <section id="how-it-works" className="flex flex-col items-center gap-6xl bg-surface-900 px-4 py-8xl md:px-9xl">
      <div className="w-full max-w-[962px]">
        <SectionHeader
          badgeIcon="/landing/star.svg"
          badge="How It Works"
          title="Why Holders Trust Sentinels"
          description="No claims process, no counterparty risk — just protection you can verify on-chain."
        />
      </div>
      <div className="flex w-full max-w-[1160px] items-stretch gap-8">
        <div className="flex flex-1 flex-col justify-center gap-10">
          {benefits.map((benefit, i) => (
            <div key={benefit.title} className="flex gap-6">
              <div className={cn("w-1 shrink-0 rounded-full", i === 0 ? "bg-primary-500" : "bg-neutral-700")} />
              <div className="flex flex-1 flex-col gap-6">
                <div className="flex self-start rounded-full bg-surface-800 p-3">
                  <img alt="" src={benefit.icon} className="size-6" />
                </div>
                <div className="flex flex-col gap-3">
                  <h3 className="text-h6 text-white">{benefit.title}</h3>
                  <p className="text-body-md text-soft-300">{benefit.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block">
          <BenefitsGraphic />
        </div>
      </div>
    </section>
  );
}
