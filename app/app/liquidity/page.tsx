import { AppPageHeader, AppShell } from "@/components/organisms/app-shell";
import { LiquidityPoolFlow } from "@/components/organisms/liquidity-pool-flow";

export default function LiquidityPage() {
  return (
    <AppShell>
      <AppPageHeader
        title="Provide liquidity, earn the spread"
        subtitle="Underwrite the AMM pool and earn a share of trading fees for taking on UP-side risk. Add or withdraw at any time before expiry."
      />
      <LiquidityPoolFlow />
    </AppShell>
  );
}
