# GST Saathi

GST compliance platform for accountants and the small shops they serve in India.
Simplifies bill matching with GSTR-2B and return preparation.

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm

### Installation & Run Steps

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Phone Preview on Same Wi-Fi

To preview the app on your mobile phone connected to the same Wi-Fi network:

```bash
npm run dev -- --hostname 0.0.0.0
```

Access it on your phone using `http://<your-local-ip>:3000`.

## How to Rename the App

The app name is centralized in configuration:
- Edit the `name` property in [`src/config/site.ts`](src/config/site.ts):
  ```ts
  export const siteConfig: SiteConfig = {
    name: "Your App Name",
    // ...
  };
  ```
All navigation headers, titles, and site metadata read directly from this file.

## Folder Map

```text
├── docs/                 # Project documentation and specifications
│   ├── DECISIONS.md      # Key architecture and design decisions
│   ├── PRODUCT_BRIEF.md  # Product vision and scope
│   ├── PROMPT_PLAN.md    # Implementation roadmap
│   └── RULES_TO_VERIFY.md# Quality and compliance checklists
├── public/               # Static assets and icons
├── src/
│   ├── app/              # Next.js App Router (pages, layout, globals.css)
│   ├── components/       # UI components
│   │   ├── layout/       # Layout components (Navbar, Footer, etc.)
│   │   ├── sections/     # Page sections and features
│   │   └── ui/           # Reusable UI primitives (Button, Container, SectionHeading)
│   └── config/           # Centralized configuration
│       └── site.ts       # App name, tagline, navigation links
├── .editorconfig         # Consistent editor formatting settings
├── .env.example          # Sample environment variables template
├── .gitignore            # Git exclusion rules
├── .prettierrc           # Prettier code style configuration
├── package.json          # Project scripts and dependencies
└── tsconfig.json         # TypeScript configuration
```

## Scripts

- `npm run dev` - Run development server
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript typecheck
