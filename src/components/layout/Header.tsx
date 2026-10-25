import React from "react";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export interface HeaderProps {
  className?: string;
}

export function Header({ className = "" }: HeaderProps) {
  return (
    <header className={`sticky top-0 z-50 bg-background border-b border-line ${className}`.trim()}>
      <Container>
        <div className="flex items-center justify-between h-16 md:h-20">
          <div className="flex items-center gap-8 lg:gap-10">
            <Link
              href="/"
              className="inline-flex items-center min-h-[48px] py-2 text-[17px] font-semibold tracking-tight text-ink hover:opacity-90 transition-opacity"
            >
              {siteConfig.name}
            </Link>

            <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-6 lg:gap-8">
              {siteConfig.navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[15px] font-medium text-muted hover:text-ink transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center">
            <Button href="#contact" variant="primary" className="whitespace-nowrap">
              Get early access
            </Button>
          </div>
        </div>
      </Container>
    </header>
  );
}

export default Header;
