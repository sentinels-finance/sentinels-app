import { Button } from "@/components/atoms/button";

const links = [
  { label: "Home", href: "#" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Docs", href: "#" },
  { label: "FAQ", href: "#" },
  { label: "Contact", href: "#" },
];

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex flex-col items-center px-4 pt-6 md:px-9xl">
      <nav className="flex h-14 w-full max-w-[962px] items-center gap-10 overflow-clip rounded-lg border border-neutral-400/10 bg-neutral-400/10 px-2 backdrop-blur-[28px]">
        <div className="flex h-8 w-[99px] shrink-0 items-center">
          <a href="#" className="flex items-center gap-1.5 pl-2">
            <span className="relative size-6 shrink-0 overflow-clip">
              <span className="absolute inset-y-0 left-[12.57%] right-[14.13%]">
                <img
                  alt=""
                  src="/landing/mark.svg"
                  className="absolute inset-0 block h-6 w-[17.592px] max-w-none"
                />
              </span>
            </span>
            <span className="whitespace-nowrap text-body-lg font-semibold text-white">Sentinels</span>
          </a>
        </div>
        <div className="hidden min-w-px flex-1 items-center justify-center gap-10 md:flex">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="flex items-center justify-center gap-1 whitespace-nowrap text-body-sm font-medium text-white transition-colors hover:text-soft-300"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="ml-auto flex h-10 w-[99px] shrink-0 items-center justify-end md:ml-0">
          <Button variant="secondary" size="sm" href="/protect" className="w-[121px]">
            Devnet Demo
          </Button>
        </div>
      </nav>
    </header>
  );
}
