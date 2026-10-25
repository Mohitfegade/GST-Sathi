import React from "react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function Audience() {
  const accountantPoints = [
    "Bills arrive sorted.",
    "Problems flagged before the 20th.",
    "Handle more clients.",
  ];

  const shopOwnerPoints = [
    "Send bills from your phone.",
    "See in simple words what is due.",
    "Avoid late fees.",
  ];

  return (
    <section id="for-accountants" className="py-16 md:py-24">
      <Container>
        <SectionHeading
          eyebrow="Who it is for"
          title="Built for both sides of the table"
          className="mb-12 md:mb-16"
        />

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* For accountants */}
          <div className="border border-line rounded-[8px] p-6 md:p-8 bg-background">
            <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-ink mb-6">
              For accountants
            </h3>
            <ul className="space-y-4">
              {accountantPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-base text-muted"
                >
                  <svg
                    className="w-5 h-5 text-accent shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                  <span className="text-ink">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* For shop owners */}
          <div className="border border-line rounded-[8px] p-6 md:p-8 bg-background">
            <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-ink mb-6">
              For shop owners
            </h3>
            <ul className="space-y-4">
              {shopOwnerPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 text-base text-muted"
                >
                  <svg
                    className="w-5 h-5 text-accent shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m4.5 12.75 6 6 9-13.5"
                    />
                  </svg>
                  <span className="text-ink">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

export default Audience;
