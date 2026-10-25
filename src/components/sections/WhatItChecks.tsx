import React from "react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

interface CheckItem {
  title: string;
  description: string;
}

const CHECK_ITEMS: CheckItem[] = [
  {
    title: "Did the supplier file?",
    description:
      "Checks whether suppliers have filed their returns so you don't lose input tax credit.",
  },
  {
    title: "Is the tax rate right on every item?",
    description: "Notebooks, registers and pens are taxed differently.",
  },
  {
    title: "Shops selling both tax-free and taxable items",
    description: "We work out the credit that must be reversed.",
  },
  {
    title: "Deadlines and late-fee risk.",
    description:
      "Highlights approaching due dates to keep your filings penalty-free.",
  },
];

export function WhatItChecks() {
  return (
    <section className="py-16 md:py-24 bg-surface">
      <Container>
        <SectionHeading
          title="What gets checked for you."
          className="mb-12 md:mb-16"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {CHECK_ITEMS.map((item) => (
            <div
              key={item.title}
              className="border border-line p-6 md:p-8 rounded-[8px] bg-background"
            >
              <h3 className="text-xl font-semibold tracking-tight text-ink mb-3">
                {item.title}
              </h3>
              <p className="text-base text-muted leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

export default WhatItChecks;
