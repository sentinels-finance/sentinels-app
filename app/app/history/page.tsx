import { AppPageHeader, AppShell } from "@/components/organisms/app-shell";
import { HistoryPanel } from "@/components/organisms/history-panel";

export default function HistoryPage() {
  return (
    <AppShell>
      <AppPageHeader
        title="History"
        subtitle="Resolved policies. Paid out when the price finished below the strike; otherwise the coverage expires."
      />
      <HistoryPanel />
    </AppShell>
  );
}
