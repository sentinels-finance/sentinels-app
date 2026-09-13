import { SectionTitle } from "@/components/atoms/section-title";
import { SectionHeader } from "@/components/molecules/section-header";

type Feature = {
  title: string;
  description: string;
  graphic: string;
  graphicHeight: number;
};

const columns: Feature[][] = [
  [
    {
      title: "1:1 collateralized",
      description:
        "Every policy is backed by USDC locked in an on-chain vault. Your payout is funded before coverage even starts.",
      graphic: "/landing/feature-collateral.png",
      graphicHeight: 420,
    },
    {
      title: "Oracle-resolved",
      description:
        "Settlement reads a live Pyth price at expiry. Stale or low-confidence updates are rejected, never a cached fallback.",
      graphic: "/landing/feature-oracle.png",
      graphicHeight: 320,
    },
  ],
  [
    {
      title: "Permissionless Resolution",
      description:
        "Anyone can trigger resolution once expiry passes, earning a small incentive. No party can block or delay settlement.",
      graphic: "/landing/feature-permissionless.png",
      graphicHeight: 320,
    },
    {
      title: "Active in One Transaction",
      description:
        "Deposit USDC, pick your coverage, and you're protected confirmed on-chain in seconds.",
      graphic: "/landing/feature-one-transaction.png",
      graphicHeight: 420,
    },
  ],
];

function FeatureCard({ title, description, graphic, graphicHeight }: Feature) {
  return (
    <article className="flex flex-col overflow-clip rounded-xl border border-neutral-700">
      <img alt="" src={graphic} width={564} height={graphicHeight} className="h-auto w-full" />
      <div className="flex flex-col gap-3 p-6 md:p-10">
        <h3 className="text-h6 text-white">{title}</h3>
        <p className="text-body-md text-soft-300">{description}</p>
      </div>
    </article>
  );
}

export function Features() {
  return (
    <section id="features" className="flex flex-col items-center px-4 py-8xl md:px-9xl">
      <SectionTitle icon="/landing/features-star.svg">Features</SectionTitle>
      <div className="mt-6xl w-full max-w-[1160px]">
        <SectionHeader
          title={
            <>
              Built to be trusted,
              <br />
              not taken on faith
            </>
          }
          description="Every guarantee below is enforced by program logic, not a promise."
        />
      </div>
      <div className="mt-6xl grid w-full max-w-[1160px] gap-8 md:grid-cols-2">
        {columns.map((column, i) => (
          <div key={i} className="flex flex-col gap-8">
            {column.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
