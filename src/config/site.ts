export interface NavLink {
  label: string;
  href: string;
}

export interface SiteConfig {
  name: string;
  tagline: string;
  contactEmail: string;
  url: string;
  navLinks: NavLink[];
}

export const siteConfig: SiteConfig = {
  name: "GST Saathi",
  tagline: "GST compliance platform for accountants and the small shops they serve in India",
  contactEmail: "hello@example.com",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://example.com",
  navLinks: [
    { label: "How it works", href: "#how-it-works" },
    { label: "For accountants", href: "#for-accountants" },
  ],
};

export const { name, tagline, contactEmail, url, navLinks } = siteConfig;
