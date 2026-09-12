"use client";

import { Button as UiButton } from "@/components/ui/button";
import { DetailRows } from "@/components/molecules/detail-rows";

export type RedeemSuccessDetails = {
  assetSymbol: string;
  payout: string;
  strike: string;
  settledPrice: string;
  signature: string;
};

type RedeemSuccessModalProps = {
  open: boolean;
  details: RedeemSuccessDetails | null;
  onClose: () => void;
};

/**
 * Framing follows the product-framing rule in docs/PRD.md: this is coverage settling, not a
 * trade paying out a "profit" — same reason ConfirmTransactionModal never mentions DOWN/UP.
 */
export function RedeemSuccessModal({ open, details, onClose }: RedeemSuccessModalProps) {
  if (!open || !details) return null;

  const rows = [
    { label: "Asset", value: details.assetSymbol },
    { label: "Strike price", value: details.strike },
    { label: "Settled at", value: details.settledPrice },
    { label: "Transaction", value: details.signature, valueClassName: "font-mono text-[11px]" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 pt-16 sm:items-center sm:pb-4 sm:pt-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 animate-fade-in bg-[rgba(20,20,22,0.9)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="redeem-success-title"
        className="animate-in zoom-in-95 fade-in relative z-10 flex w-full max-w-[420px] flex-col items-center gap-5 overflow-y-auto rounded-card border border-neutrals-3 bg-[#141517] p-6 text-center shadow-[0px_24px_48px_-16px_rgba(15,15,15,0.4)] duration-300 sm:p-7"
      >
        <span className="flex size-16 shrink-0 animate-check-pop items-center justify-center rounded-full bg-[#1f3d2e] text-primary-2">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <div className="flex flex-col gap-1">
          <h2
            id="redeem-success-title"
            className="m-0 font-display text-[22px] font-bold leading-8 tracking-[-0.22px] text-neutrals-8"
          >
            Coverage settled
          </h2>
          <p className="m-0 font-body text-caption-2 text-neutrals-5">
            Your payout has been sent to your wallet.
          </p>
        </div>

        <p className="m-0 animate-rise-in font-display text-[36px] font-bold leading-10 tracking-[-0.36px] text-primary-2">
          {details.payout}
        </p>

        <div className="h-px w-full bg-neutrals-3" />
        <div className="w-full text-left">
          <DetailRows rows={rows} />
        </div>

        <UiButton type="button" variant="neutral" size="medium" className="w-full" onClick={onClose}>
          Done
        </UiButton>
      </div>
    </div>
  );
}
