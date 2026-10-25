import React from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Container } from "@/components/ui/Container";

export function Footer() {
  const currentYear = 2026;

  return (
    <footer className="border-t border-line bg-background py-12">
      <Container>
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md space-y-3">
            <span className="text-lg font-semibold tracking-tight text-ink">
              {siteConfig.name}
            </span>
            <p className="text-sm leading-relaxed text-muted">
              Prepares your GST return. Filing is done by the shop owner or a
              professional.
            </p>
          </div>

          <div className="flex flex-col gap-4 text-sm md:items-end">
            {siteConfig.navLinks && siteConfig.navLinks.length > 0 && (
              <nav aria-label="Footer Navigation" className="flex flex-wrap gap-6">
                {siteConfig.navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-muted transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            )}

            <div>
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="text-muted underline underline-offset-4 transition-colors hover:text-ink"
              >
                {siteConfig.contactEmail}
              </a>
            </div>

            <p className="text-xs text-muted">
              &copy; {currentYear} {siteConfig.name}. All rights reserved.
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}

export default Footer;
