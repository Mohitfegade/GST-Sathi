import React from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";

export function FinalCta() {
  return (
    <section id="contact" className="border-t border-line bg-background py-20 md:py-28">
      <Container>
        <div className="flex flex-col items-center text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl md:text-5xl">
            Want early access?
          </h2>
          <p className="mb-8 max-w-[560px] text-lg text-muted">
            Write to us to get early access for your practice or shop.
          </p>
          <Button
            href={`mailto:${siteConfig.contactEmail}?subject=Early%20Access%20Request`}
            variant="primary"
          >
            Get early access
          </Button>
        </div>
      </Container>
    </section>
  );
}

export default FinalCta;
