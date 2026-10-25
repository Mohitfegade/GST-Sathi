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
      <Header />
      <main>
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
