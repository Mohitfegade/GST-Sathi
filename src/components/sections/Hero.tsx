import React from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="bg-background pt-20 pb-16 md:pt-28 md:pb-24 text-left">
      <Container>
        <div className="max-w-[800px]">
          <h1 id="hero-heading" className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-ink">
            GST paperwork, sorted before the deadline.
          </h1>
          <p className="text-lg sm:text-xl text-muted max-w-[680px] leading-relaxed mt-6 mb-8">
            For accountants and the small shops they serve. Clients send their bills. We read them, match them with GSTR-2B and prepare the return. A person reviews and files.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Button href="#contact" variant="primary" className="w-full sm:w-auto">
              Get early access
            </Button>
            <Button href="#how-it-works" variant="secondary" className="w-full sm:w-auto">
              See how it works
            </Button>
          </div>
          <p className="text-sm text-muted mt-6">
            Early access. Built for small shops and their accountants.
          </p>
        </div>
      </Container>
    </section>
  );
}

export default Hero;
