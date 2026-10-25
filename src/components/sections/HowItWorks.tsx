import React from "react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface Step {
  number: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    number: "01",
    title: "Client sends bills",
    body: "A simple upload link for each client. Photo or PDF.",
  },
  {
    number: "02",
    title: "Bills are read and checked",
    body: "Details are extracted. Anything unclear is flagged for a person.",
  },
  {
    number: "03",
    title: "Matched with GSTR-2B",
    body: "Missing supplier filings and mismatches are listed with the rupee amount.",
  },
  {
    number: "04",
    title: "Review and file",
    body: "Download the drafted return. A person approves and files. Nothing is filed automatically.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-background">
      <Container>
        <SectionHeading
          eyebrow="Workflow"
          title="How it works"
          description="Four simple steps to get your returns prepared accurately and on time."
          className="mb-12 md:mb-16"
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="border border-line rounded-[8px] p-6 md:p-8 bg-surface flex flex-col"
            >
              <span className="text-3xl md:text-4xl font-bold tracking-tight text-accent mb-4 md:mb-6">
                {step.number}
              </span>
              <h3 className="text-xl font-semibold tracking-tight text-ink mb-3">
                {step.title}
              </h3>
              <p className="text-base text-muted leading-relaxed">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export default HowItWorks;
