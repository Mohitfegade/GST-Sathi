# Product Brief: GST Saathi

A simple, dependable GST compliance platform connecting Indian accountants and the small retail businesses they serve.

## Target Users
- **Accountant (Primary Customer)**: Manages GST compliance for dozens of small business clients. Needs accurate reconciliation, error prevention, and clean exports without manual data entry.
- **Shop Owner**: Small retail merchant who sends purchase and sales bills to their accountant. Needs a frictionless way to share documents without tax complexity.

## MVP Scope
1. **Bill & Document Upload**: Upload purchase and sales bills (PDF, images, spreadsheets) and government GSTR-2B JSON/Excel files.
2. **Draft Returns**: Automatically draft GSTR-1 (outward supplies) and GSTR-3B (monthly summary with ITC reconciliation) from verified bill data.
3. **Export Formats**: One-click export to standard GST portal JSON and Tally-compatible XML.
4. **Human Review & Filing**: Return filing remains human-driven; accountants verify drafts and file returns directly on the official portal.

## Explicitly Out of Scope
The following capabilities are deliberately excluded from the MVP:
- Live GSP (GST Suvidha Provider) portal APIs
- WhatsApp messaging integration
- E-way bills
- E-invoicing
- Auto-filing

## Design Principles
- **Plain English**: Direct, clear language for non-technical users. Avoid jargon, keep sentences short, and ensure one clear action per section.
- **Light Theme Only**: Clean, high-contrast palette using designated tokens. Strictly no pastels, no gradients, and no emojis.
- **Typography-Led**: Rely on clean font hierarchy, large legible text, and uncluttered layouts.
- **Mobile-First**: Fully responsive layouts optimized across 375px, 768px, and 1280px breakpoints.
