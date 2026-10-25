import { Header } from "@/components/layout/Header";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { WhatItChecks } from "@/components/sections/WhatItChecks";
import { Audience } from "@/components/sections/Audience";
import { FinalCta } from "@/components/sections/FinalCta";
import { Footer } from "@/components/layout/Footer";

export default function Home() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-on-accent focus:rounded-[8px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent font-medium text-sm"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <Problem />
        <HowItWorks />
        <WhatItChecks />
        <Audience />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
