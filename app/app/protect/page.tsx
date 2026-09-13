import { AppPageHeader, AppShell } from "@/components/organisms/app-shell";
import { ProtectFlow } from "@/components/organisms/protect-flow";

export default function ProtectPage() {
  return (
    <AppShell>
      <AppPageHeader
        title="Downside protection, fully collateralized"
        subtitle="Every policy is backed 1:1 by USDC in an on-chain vault. Payouts settle when Pyth confirms a decline. No claims, no counterparty risk."
      />
      <ProtectFlow />
    </AppShell>
  );
}
