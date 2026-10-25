import React from "react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

// Figures to be re-verified (see docs/RULES_TO_VERIFY.md)
const FACTS = [
  {
    figure: "₹50 a day",
    description: "late fee on a GST return (per day, up to a cap)",
  },
  {
    figure: "18% a year",
    description: "interest on tax paid late",
  },
  {
    figure: "14th",
    description:
      "the day GSTR-2B arrives; a supplier who has not filed by the 11th can hold back your credit.",
  },
];

export function Problem() {
  return (
    <section className="bg-surface py-16 md:py-24 border-y border-line">
      <Container>
        <SectionHeading
          title="Missed dates cost real money."
          className="mb-12 md:mb-16"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {FACTS.map((fact) => (
            <div
              key={fact.figure}
              className="border border-line rounded-[8px] p-6 md:p-8 bg-background flex flex-col justify-start"
            >
              <div className="text-4xl md:text-5xl font-bold tracking-tight text-ink mb-3">
                {fact.figure}
              </div>
              <p className="text-base text-muted leading-relaxed">
                {fact.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export default Problem;
