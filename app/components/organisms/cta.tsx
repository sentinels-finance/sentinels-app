import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

const screws = [
  "left-[6.67px] top-[6.67px]",
  "right-[6.67px] top-[6.67px]",
  "bottom-[6.67px] left-[6.67px]",
  "bottom-[6.67px] right-[6.67px]",
] as const;

export function Cta() {
  return (
    <section className="px-4 md:px-9xl">
      <div className="relative mx-auto flex w-full max-w-[1160px] flex-col items-center gap-5xl rounded-xl border border-primary-700 bg-strong-950 p-7xl">
        <div className="pointer-events-none absolute left-1/2 top-[78px] size-[104px] -translate-x-1/2">
          <div className="absolute inset-[-96.15%]">
            <img alt="" src="/landing/cta-glow.svg" className="block h-[304px] w-[304px] max-w-none" />
          </div>
        </div>
        <div className="relative h-[120px] w-[816px] shrink-0">
          <div className="absolute left-[361px] top-1/2 size-[94px] -translate-y-1/2">
            <div className="absolute inset-[-106.38%]">
              <img alt="" src="/landing/cta-center-mask.svg" className="block h-[294px] w-[294px] max-w-none" />
            </div>
          </div>
          <div className="absolute left-0 top-[24px] h-[72px] w-[816px]">
            <img alt="" src="/landing/cta-icons.svg" className="absolute inset-0 block h-[72px] w-[816px] max-w-none" />
          </div>
          <div className="absolute left-[348px] top-0 flex size-[120px] items-center p-[26.667px]">
            <div className="pointer-events-none absolute inset-0 rounded-[13.333px] border-[0.833px] border-neutral-400 bg-plate shadow-[0px_13.333px_20px_6.667px_rgba(14,18,27,0.5),0px_0px_0px_2.5px_rgb(var(--primary-500))]">
              <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0px_-10px_10px_0px_rgb(var(--neutral-900)),inset_0px_3.333px_26.667px_0px_rgb(var(--neutral-700))]" />
            </div>
            <div className="relative size-[66.667px] shrink-0 overflow-clip">
              <div className="absolute inset-y-0 left-[12.57%] right-[14.13%]">
                <img
                  alt=""
                  src="/landing/mark.svg"
                  className="absolute inset-0 block h-[66.667px] w-[48.868px] max-w-none"
                />
              </div>
            </div>
            {screws.map((pos) => (
              <div key={pos} className={cn("absolute size-[10px]", pos)}>
                <div className="absolute inset-[-8.33%]">
                  <img alt="" src="/landing/cta-screw.svg" className="block h-[11.667px] w-[11.667px] max-w-none" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex w-full flex-col items-center gap-3xl">
          <div className="flex w-full flex-col items-center gap-3 text-center">
            <h2 className="w-full bg-heading-gradient bg-clip-text text-h3 text-transparent">
              Ready to Protect Your Asset?
            </h2>
            <p className="w-full text-body-md text-soft-300">
              Deposit USDC, pick your coverage, and your protection is active in one transaction.
            </p>
          </div>
          <Button variant="primary" href="#">
            Join Waitlist
          </Button>
        </div>
      </div>
    </section>
  );
}
