import { Benefits } from "@/components/organisms/benefits";
import { Cta } from "@/components/organisms/cta";
import { Ecosystem } from "@/components/organisms/ecosystem";
import { Features } from "@/components/organisms/features";
import { HomeHero } from "@/components/organisms/home-hero";
import { SiteFooter } from "@/components/organisms/site-footer";
import { SiteNav } from "@/components/organisms/site-nav";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-strong-950">
      <SiteNav />
      <HomeHero />
      <Features />
      <Benefits />
      <Ecosystem />
      <div className="bg-[linear-gradient(to_bottom,rgb(var(--neutral-950))_50%,rgb(var(--neutral-900))_50%)]">
        <Cta />
      </div>
      <SiteFooter />
    </div>
  );
}
