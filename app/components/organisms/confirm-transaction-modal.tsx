"use client";

import { Button } from "@/components/atoms/button";

export type ConfirmRow = {
  label: string;
  value: string;
  accent?: boolean;
};

export function ConfirmTransactionModal({
  open,
  title,
  rows,
  note,
  error,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  rows: ConfirmRow[];
  note: string;
  error?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-strong-950/80 px-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-tx-title"
        className="relative z-10 flex w-full max-w-[480px] flex-col gap-lg overflow-clip rounded-md border border-neutral-700 bg-surface-900 p-xl"
      >
        <h2 id="confirm-tx-title" className="m-0 text-h6 text-white">
          {title}
        </h2>
        <p className="m-0 text-body-md text-soft-300">
          {busy ? "Waiting for wallet confirmation…" : "Review the details below before signing in your wallet."}
        </p>
        <div className="h-px w-full bg-neutral-700" />
        <div className="flex w-full flex-col gap-md">
          {rows.map((row) => (
            <div key={row.label} className="flex w-full items-center justify-between">
              <span className="text-body-sm text-soft-300">{row.label}</span>
              <span className={row.accent ? "text-body-md font-semibold text-success-500" : "text-body-md font-semibold text-white"}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
        <p className="m-0 text-body-sm text-soft-300">{note}</p>
        {error ? (
          <p className="m-0 text-body-sm text-primary-400" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex w-full gap-md">
          <Button variant="secondary" size="md" className="min-w-0 flex-1" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="md" className="min-w-0 flex-1" disabled={busy} onClick={onConfirm}>
            {busy ? "Signing…" : "Confirm & sign"}
          </Button>
        </div>
      </div>
    </div>
  );
}
