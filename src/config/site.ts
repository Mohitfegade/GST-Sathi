export interface NavLink {
  label: string;
  href: string;
}

export interface AuthLinks {
  login: string;
  signup: string;
}

export interface AuthLabels {
  login: string;
  signup: string;
}

export interface SiteConfig {
  name: string;
  tagline: string;
  contactEmail: string;
  url: string;
  navLinks: NavLink[];
  authLinks: AuthLinks;
  authLabels: AuthLabels;
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
  authLinks: {
    login: "/login",
    signup: "/signup",
  },
  authLabels: {
    login: "Log in",
    signup: "Create account",
  },
};

export const { name, tagline, contactEmail, url, navLinks, authLinks, authLabels } = siteConfig;

