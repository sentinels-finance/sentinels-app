import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

const plateScrews = ["left-2 top-2", "right-2 top-2", "bottom-2 left-2", "bottom-2 right-2"] as const;

const clusterScrews = [
  { pos: "right-1 top-1", src: "/landing/hero-network/screw-6a.svg" },
  { pos: "bottom-1 right-1", src: "/landing/hero-network/screw-6b.svg" },
  { pos: "left-1 top-1", src: "/landing/hero-network/screw-6b.svg" },
  { pos: "bottom-1 left-1", src: "/landing/hero-network/screw-6b.svg" },
] as const;

function HeroNetwork() {
  return (
    <div className="relative h-[500px] w-[1160px] max-w-full shrink-0 overflow-clip">
      <div className="absolute left-[859px] top-[257px] h-[343px] w-[171px]">
        <div className="absolute inset-[0_-0.58%]">
          <img
            alt=""
            src="/landing/hero-network/line-right.svg"
            className="block h-[343px] w-[173px] max-w-none"
          />
        </div>
      </div>
      <div
        className="absolute left-[349px] top-[67px] h-[366px] w-[462px]"
        style={{
          WebkitMaskImage: "url(/landing/hero-network/mask-source.svg)",
          maskImage: "url(/landing/hero-network/mask-source.svg)",
          WebkitMaskSize: "350px 350px",
          maskSize: "350px 350px",
          WebkitMaskPosition: "56px 8px",
          maskPosition: "56px 8px",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
        }}
      >
        <img
          alt=""
          src="/landing/hero-network/mask-fill.svg"
          className="absolute inset-0 block h-[366px] w-[462px] max-w-none"
        />
      </div>
      <div className="absolute left-[calc(50%+0.5px)] top-[calc(50%+0.5px)] size-[67px] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-[-149.25%]">
          <img
            alt=""
            src="/landing/hero-network/center-glow.svg"
            className="block h-[267px] w-[267px] max-w-none"
          />
        </div>
      </div>
      <div className="absolute left-[-46.5px] top-[97.5px] h-[153.5px] w-[622px]">
        <div className="absolute inset-[-0.65%_0]">
          <img
            alt=""
            src="/landing/hero-network/line-left.svg"
            className="block h-[155.5px] w-[622px] max-w-none"
          />
        </div>
      </div>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center p-2xl">
        <div className="pointer-events-none absolute inset-0 rounded-lg border border-neutral-400 bg-plate shadow-[0px_16px_24px_8px_rgba(14,18,27,0.5),0px_0px_0px_3px_rgb(var(--primary-500))]">
          <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0px_-12px_12px_0px_rgb(var(--neutral-900)),inset_0px_4px_32px_0px_rgb(var(--neutral-700))]" />
        </div>
        <div className="relative size-20 shrink-0 overflow-clip">
          <div className="absolute inset-y-0 left-[12.57%] right-[14.13%]">
            <img
              alt=""
              src="/landing/mark.svg"
              className="absolute inset-0 block h-20 w-[58.641px] max-w-none"
            />
          </div>
        </div>
        {plateScrews.map((pos) => (
          <div key={pos} className={cn("absolute size-3", pos)}>
            <div className="absolute inset-[-8.33%]">
              <img
                alt=""
                src="/landing/hero-network/screw-12.svg"
                className="block h-[14px] w-[14px] max-w-none"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="absolute left-[657.5px] top-[57.5px] h-[199px] w-[690.5px]">
        <div className="absolute inset-[-0.5%_0]">
          <img
            alt=""
            src="/landing/hero-network/line-top.svg"
            className="block h-[201px] w-[690.5px] max-w-none"
          />
        </div>
      </div>
      <div className="absolute left-[calc(50%+278px)] top-[calc(50%+132px)] size-[72px] -translate-x-1/2 -translate-y-1/2">
        <img
          alt=""
          src="/landing/hero-network/node-shield.svg"
          className="absolute inset-0 block h-[72px] w-[72px] max-w-none"
        />
      </div>
      <div className="absolute left-[124px] top-[128px] flex items-start p-lg">
        <div className="pointer-events-none absolute inset-0 rounded-sm">
          <div className="absolute inset-0 rounded-sm bg-plate" />
          <div className="absolute inset-0 rounded-[inherit] shadow-plate" />
        </div>
        {clusterScrews.map((screw) => (
          <div key={screw.pos} className={cn("absolute size-[6px]", screw.pos)}>
            <div className="absolute inset-[-8.33%]">
              <img alt="" src={screw.src} className="block h-[7px] w-[7px] max-w-none" />
            </div>
          </div>
        ))}
        <div className="relative mr-[-16px] size-[58px] shrink-0 overflow-clip rounded-[13.333px] border-[0.483px] border-neutral-700">
          <img
            alt=""
            src="/landing/hero-network/icon-btc.svg"
            className="absolute inset-0 block h-[58px] w-[58px] max-w-none"
          />
        </div>
        <div className="relative mr-[-16px] size-[58px] shrink-0 overflow-clip rounded-[50px]">
          <img
            alt=""
            src="/landing/hero-network/icon-sol.svg"
            className="absolute inset-0 block h-[58px] w-[58px] max-w-none"
          />
        </div>
        <div className="relative size-[58px] shrink-0 overflow-clip rounded-[13.333px] border-[0.483px] border-neutral-700">
          <img
            alt=""
            src="/landing/hero-network/icon-usdc.svg"
            className="absolute inset-0 block h-[58px] w-[58px] max-w-none"
          />
        </div>
      </div>
      <div className="absolute left-[67.5px] top-[325.5px] h-[354.5px] w-[513px]">
        <div className="absolute inset-[0_-0.19%]">
          <img
            alt=""
            src="/landing/hero-network/line-bottom.svg"
            className="block h-[354.5px] w-[515px] max-w-none"
          />
        </div>
      </div>
      <div className="absolute left-[calc(50%-198px)] top-[calc(50%+160px)] size-[72px] -translate-x-1/2 -translate-y-1/2">
        <img
          alt=""
          src="/landing/hero-network/node-crypto.svg"
          className="absolute inset-0 block h-[72px] w-[72px] max-w-none"
        />
      </div>
      <div className="absolute left-[calc(50%+370px)] top-[calc(50%-100px)] size-[72px] -translate-x-1/2 -translate-y-1/2">
        <img
          alt=""
          src="/landing/hero-network/node-bank.svg"
          className="absolute inset-0 block h-[72px] w-[72px] max-w-none"
        />
      </div>
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-[500px] w-[1160px]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 1160 500' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(2.4091e-14 59.85 -63.824 1.4253e-14 580 -2.2204e-13)'><stop stop-color='rgba(14,18,27,0)' offset='0.4882'/><stop stop-color='rgba(14,18,27,1)' offset='1'/></radialGradient></defs></svg>\")",
        }}
      />
    </div>
  );
}

export function HomeHero() {
  return (
    <section className="relative flex flex-col items-center gap-8 px-4 pb-10 pt-[200px] md:px-9xl">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[780px] w-[1440px] -translate-x-1/2">
        <img alt="" src="/landing/lightbeam-70.svg" className="absolute left-[128px] top-[-548px] h-[1043px] w-[1183px] max-w-none mix-blend-plus-lighter" />
        <img alt="" src="/landing/lightbeam-69.svg" className="absolute left-[283px] top-[-548px] h-[1043px] w-[873px] max-w-none mix-blend-plus-lighter" />
        <img alt="" src="/landing/lightbeam-68.svg" className="absolute left-[435px] top-[-512px] h-[971px] w-[569px] max-w-none mix-blend-plus-lighter" />
      </div>

      <div className="relative flex w-full max-w-[762px] flex-col items-center gap-5xl">
        <div className="flex w-full flex-col items-center gap-3 text-center">
          <h1 className="bg-heading-gradient bg-clip-text text-[40px] font-semibold leading-[48px] tracking-[-0.04em] text-transparent md:text-h2">
            Insure your crypto
            <br />
            against the fall
          </h1>
          <p className="max-w-[481px] text-body-md text-soft-300">
            Fully backed protection for your crypto, powered by real-time market prices.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" href="#" className="w-[150px]">
            Join Waitlist
          </Button>
          <Button variant="neutral" href="#" className="w-[150px]">
            Devnet Demo
          </Button>
        </div>
      </div>

      <HeroNetwork />
    </section>
  );
}
