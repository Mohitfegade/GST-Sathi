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
        <div className="flex items-center justify-between h-16 md:h-20 gap-2 sm:gap-4">
          <div className="flex items-center gap-6 lg:gap-10 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center min-h-[48px] py-2 text-[17px] font-semibold tracking-tight text-ink hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {siteConfig.name}
            </Link>

            <nav aria-label="Main" className="hidden md:flex items-center gap-6 lg:gap-8">
              {siteConfig.navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center text-[15px] font-medium text-muted hover:text-ink transition-colors rounded-[6px] py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Link
              href={siteConfig.authLinks?.login ?? "/login"}
              className="inline-flex items-center justify-center min-h-[48px] px-2 sm:px-3 text-[14px] sm:text-[15px] font-medium text-muted hover:text-ink transition-colors whitespace-nowrap rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Log in
            </Link>
            <Button
              href={siteConfig.authLinks?.signup ?? "/signup"}
              variant="primary"
              className="whitespace-nowrap max-sm:px-3 max-sm:text-[14px]"
            >
              <span className="hidden sm:inline">Create account</span>
              <span className="sm:hidden">Sign up</span>
            </Button>
          </div>
        </div>
      </Container>
    </header>
  );
}

export default Header;
