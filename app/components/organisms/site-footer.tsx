const legal = ["Privacy Policy", "Terms of Service", "Security Policy"];

export function SiteFooter() {
  return (
    <footer className="bg-surface-900 px-4 py-8xl md:px-9xl">
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6xl">
        <div className="flex flex-col gap-5xl md:flex-row md:items-center">
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex w-[204.75px] items-center gap-[9px]">
              <img alt="" src="/landing/mark-footer.svg" className="h-9 w-[26.388px] shrink-0" />
              <span className="whitespace-nowrap text-[27px] font-semibold leading-[48px] tracking-[-0.02em] text-white">
                Sentinels
              </span>
            </div>
            <p className="text-body-md text-soft-300">
              Fully collateralized downside protection for crypto, settled on-chain.
            </p>
          </div>
          <a href="#" aria-label="X" className="relative size-6 shrink-0">
            <img alt="" src="/landing/social-x.svg" className="absolute inset-0 block h-6 w-6 max-w-none" />
          </a>
        </div>
        <hr className="m-0 h-0 border-0 border-t border-neutral-700" />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-center md:gap-6xl">
          <p className="flex-1 text-body-sm text-sub-500">© 2026 Sentinels — Devnet MVP, not audited.</p>
          {legal.map((link) => (
            <a key={link} href="#" className="text-body-sm font-medium text-sub-500 hover:text-soft-300">
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
