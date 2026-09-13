import { AppNav } from "@/components/organisms/app-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-strong-950">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[780px] w-[1440px] -translate-x-1/2"
      >
        <img
          alt=""
          src="/landing/lightbeam-70.svg"
          className="absolute left-[128px] top-[-548px] h-[1043px] w-[1183px] max-w-none mix-blend-plus-lighter"
        />
        <img
          alt=""
          src="/landing/lightbeam-69.svg"
          className="absolute left-[283px] top-[-548px] h-[1043px] w-[873px] max-w-none mix-blend-plus-lighter"
        />
        <img
          alt=""
          src="/landing/lightbeam-68.svg"
          className="absolute left-[435px] top-[-512px] h-[971px] w-[569px] max-w-none mix-blend-plus-lighter"
        />
      </div>
      <AppNav />
      <main className="relative mx-auto flex w-full max-w-[1160px] flex-col gap-[50px] px-4 pb-16 pt-[168px] md:px-0">
        {children}
      </main>
    </div>
  );
}

export function AppPageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex w-full flex-col items-center gap-md text-center">
      <h1 className="w-full bg-heading-gradient bg-clip-text text-h3 text-transparent">{title}</h1>
      <p className="w-full text-body-md text-soft-300">{subtitle}</p>
    </header>
  );
}
