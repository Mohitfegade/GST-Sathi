import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: `Privacy Policy - ${siteConfig.name}`,
  description: `Privacy policy, DPDP Act compliance, and strict confidentiality of tax documents on ${siteConfig.name}.`,
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-line bg-background py-4 px-5 md:px-8">
        <div className="max-w-[1120px] mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center min-h-[48px] text-xl font-bold tracking-tight text-ink hover:opacity-90 transition-opacity"
          >
            {siteConfig.name}
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center min-h-[48px] px-4 py-2 text-[15px] font-semibold text-accent hover:text-accent-hover underline underline-offset-4 transition-colors"
          >
            Back to sign up
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-5 py-10 md:py-16">
        <div className="max-w-[800px] mx-auto">
          {/* Back link */}
          <div className="mb-6">
            <Link
              href="/signup"
              className="inline-flex items-center min-h-[48px] text-[15px] font-medium text-accent hover:text-accent-hover underline underline-offset-4"
            >
              ← Back to sign up
            </Link>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink mb-3">
            Privacy Policy
          </h1>
          <p className="text-[15px] text-muted mb-8">
            Effective Date: October 26, 2026
          </p>

          {/* Plain English Summary Callout */}
          <div className="bg-surface border border-line rounded-[8px] p-6 mb-10">
            <h2 className="text-lg font-bold text-ink mb-2">Our Privacy Promise</h2>
            <p className="text-[16px] text-muted leading-relaxed">
              We treat all tax records, purchase invoices, and client books with
              strict confidentiality. We never sell, rent, or monetize your data. We
              comply fully with India&apos;s Digital Personal Data Protection (DPDP) Act,
              2023.
            </p>
          </div>

          {/* Detailed Legal Sections */}
          <div className="space-y-8 text-[17px] text-ink leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                1. Digital Personal Data Protection (DPDP) Act Compliance
              </h2>
              <p className="text-muted">
                {siteConfig.name} operates in accordance with the provisions of
                India&apos;s Digital Personal Data Protection Act, 2023. When accounting
                firms process information on behalf of their small business clients, the
                accounting firm acts as the <strong>Data Fiduciary</strong>, and{' '}
                {siteConfig.name} operates as a <strong>Data Processor</strong> under
                strict security mandates.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                2. Information We Collect
              </h2>
              <p className="text-muted">
                We collect only the data needed to perform GST reconciliation and return
                draft preparation:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>
                  <strong>Account Information:</strong> Name, work email address,
                  encrypted password, and accounting firm or practice name.
                </li>
                <li>
                  <strong>Business and Tax Information:</strong> GSTIN, legal business
                  name, trade name, tax return periods, and contact details.
                </li>
                <li>
                  <strong>Transactional and Invoice Data:</strong> Uploaded purchase and
                  sales invoices, supplier GSTINs, invoice dates, HSN codes, taxable
                  amounts, and tax breakdowns (IGST, CGST, SGST, Cess).
                </li>
                <li>
                  <strong>Technical and Audit Logs:</strong> Login timestamps, IP
                  addresses, and activity history for fraud detection and statutory audit
                  compliance.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                3. Confidentiality of Tax Documents
              </h2>
              <p className="text-muted">
                Tax returns and financial invoices are sensitive business assets. We
                maintain strict confidentiality protocols:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>
                  <strong>No Commercial Exploitation:</strong> Your business figures,
                  customer lists, and supplier margins are never shared, sold, or rented
                  to third-party advertisers.
                </li>
                <li>
                  <strong>Strict Tenant Isolation:</strong> Every accounting practice and
                  client is isolated using Row Level Security (RLS). Staff from other
                  firms cannot view or access your clients&apos; files.
                </li>
                <li>
                  <strong>Internal Access Controls:</strong> Our technical team cannot
                  read invoice contents except when diagnosing a customer support request
                  with your explicit permission.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                4. How We Use Information
              </h2>
              <p className="text-muted">
                We use collected data solely for the following business purposes:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>
                  To match your internal purchase records against government GSTR-2B
                  data.
                </li>
                <li>
                  To flag missing input tax credit (ITC) and identify supplier
                  discrepancies.
                </li>
                <li>
                  To generate draft computation sheets for GSTR-1 and GSTR-3B.
                </li>
                <li>
                  To communicate critical system alerts, maintenance notices, and security
                  updates.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                5. Data Security and Storage
              </h2>
              <p className="text-muted">
                All data is encrypted in transit using Transport Layer Security (TLS
                1.3) and encrypted at rest using AES-256 standard encryption. Our
                servers are hosted within ISO 27001 and SOC 2 certified data center
                facilities located in India.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                6. Data Retention and Erasure
              </h2>
              <p className="text-muted">
                We retain client tax documents for the duration required by statutory
                Indian GST laws (generally up to 72 months from the annual return due
                date) or until you request account closure. When an account is closed,
                records are purged from production databases following statutory
                confirmation periods.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                7. Your Rights Under DPDP Act
              </h2>
              <p className="text-muted">
                Under the DPDP Act, 2023, data principals have the following statutory
                rights:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>Right to access summaries of personal data processed.</li>
                <li>Right to correction and completion of inaccurate records.</li>
                <li>Right to withdraw processing consent.</li>
                <li>Right to grievance redressal.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                8. Grievance Officer and Contact Details
              </h2>
              <p className="text-muted">
                For questions regarding this policy, data rights requests, or grievances,
                please write to our Grievance Officer at:
              </p>
              <div className="bg-surface border border-line rounded-[8px] p-4 text-muted">
                <p className="font-semibold text-ink">Grievance &amp; Privacy Officer</p>
                <p>{siteConfig.name}</p>
                <p>
                  Email:{' '}
                  <a
                    href={`mailto:${siteConfig.contactEmail}`}
                    className="text-accent underline underline-offset-4 hover:text-accent-hover font-medium"
                  >
                    {siteConfig.contactEmail}
                  </a>
                </p>
              </div>
            </section>
          </div>

          {/* Bottom Back Button */}
          <div className="mt-12 pt-8 border-t border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-[8px] bg-accent text-on-accent hover:bg-accent-hover font-semibold transition-colors"
            >
              Continue with account sign up
            </Link>
            <Link
              href="/terms"
              className="inline-flex items-center min-h-[48px] text-[15px] font-semibold text-accent hover:text-accent-hover underline underline-offset-4"
            >
              Read Terms of Service →
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line py-6 px-5 text-center text-sm text-muted">
        <p>&copy; 2026 {siteConfig.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
