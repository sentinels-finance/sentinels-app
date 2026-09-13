import { AppPageHeader, AppShell } from "@/components/organisms/app-shell";
import { PositionsPanel } from "@/components/organisms/positions-panel";

export default function PositionsPage() {
  return (
    <AppShell>
      <AppPageHeader
        title="Your positions"
        subtitle="Active coverage you are holding. Redeem USDC after Pyth resolves a decline in your favor."
      />
      <PositionsPanel />
    </AppShell>
  );
}
