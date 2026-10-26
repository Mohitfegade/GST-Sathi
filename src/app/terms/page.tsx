import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: `Terms of Service - ${siteConfig.name}`,
  description: `Terms of service and legal responsibilities for accountants and clients using ${siteConfig.name}.`,
};

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="text-[15px] text-muted mb-8">
            Effective Date: October 26, 2026
          </p>

          {/* Plain English Summary Callout */}
          <div className="bg-surface border border-line rounded-[8px] p-6 mb-10">
            <h2 className="text-lg font-bold text-ink mb-2">Plain English Summary</h2>
            <p className="text-[16px] text-muted leading-relaxed">
              GST Saathi helps accountants organize bills, match invoices with
              GSTR-2B, and prepare return drafts. We are a software tool. We do not
              file returns for you. The shop owner and the accountant remain
              responsible for verifying all numbers and filing on the official GST
              portal.
            </p>
          </div>

          {/* Detailed Legal Sections */}
          <div className="space-y-8 text-[17px] text-ink leading-relaxed">
            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                1. Agreement to Terms
              </h2>
              <p className="text-muted">
                By creating an account or using {siteConfig.name}, you agree to be
                bound by these Terms of Service. If you are registering on behalf of an
                accounting firm or business entity, you confirm that you have the legal
                authority to accept these terms for that entity.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                2. Scope of Service and Non-Filing Notice
              </h2>
              <p className="text-muted">
                {siteConfig.name} provides software tools for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>Extracting invoice data from uploaded documents.</li>
                <li>Reconciling purchase records with government GSTR-2B files.</li>
                <li>Identifying mismatched tax amounts and missing supplier invoices.</li>
                <li>Preparing draft summaries for GSTR-1 and GSTR-3B filings.</li>
              </ul>
              <p className="text-muted">
                <strong>Important Notice:</strong> {siteConfig.name} is not a tax
                consultancy, chartered accountancy firm, or government agency. We do
                not submit filings directly to the GST Network (GSTN). Statutory
                compliance, final data review, and filing remain the responsibility of
                the taxpayer and their appointed accountant.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                3. Firm Accounts and Member Permissions
              </h2>
              <p className="text-muted">
                Accounting firms may register staff members and invite clients. The firm
                administrator is responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>Maintaining confidentiality of login credentials.</li>
                <li>Setting appropriate staff permissions for client files.</li>
                <li>
                  Promptly revoking access for employees who leave the practice.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                4. Client Documents and Data Accuracy
              </h2>
              <p className="text-muted">
                Users are solely responsible for the authenticity and legality of
                invoices, bills, and GST figures uploaded to the platform. You agree not
                to upload fraudulent documents or knowingly enter inaccurate tax
                information.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                5. Fees and Subscription
              </h2>
              <p className="text-muted">
                Certain features may be subject to subscription plans or usage quotas.
                Any applicable fees will be communicated prior to purchase. Payments are
                processed through secure Indian payment gateways.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                6. Intellectual Property
              </h2>
              <p className="text-muted">
                The software, design, logos, and reconciliation algorithms are owned by{' '}
                {siteConfig.name}. You retain full ownership of the business and client
                data you upload to the platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                7. Limitation of Liability
              </h2>
              <p className="text-muted">
                To the maximum extent permitted by Indian law, {siteConfig.name} is not
                liable for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted">
                <li>Interest, late fees, or tax penalties levied by tax authorities.</li>
                <li>Loss of profits or business interruption.</li>
                <li>Errors arising from inaccurate source documents or user oversight.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                8. Termination
              </h2>
              <p className="text-muted">
                You may terminate your account at any time. We reserve the right to
                suspend accounts that violate these terms, compromise system security,
                or fail to comply with statutory requirements.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                9. Changes to Terms
              </h2>
              <p className="text-muted">
                We may revise these terms periodically. Continued use of the platform
                after updates constitutes acceptance of the revised terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                10. Contact Information
              </h2>
              <p className="text-muted">
                If you have questions about these terms, please contact our team at{' '}
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="text-accent underline underline-offset-4 hover:text-accent-hover font-medium"
                >
                  {siteConfig.contactEmail}
                </a>
                .
              </p>
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
              href="/privacy"
              className="inline-flex items-center min-h-[48px] text-[15px] font-semibold text-accent hover:text-accent-hover underline underline-offset-4"
            >
              Read our Privacy Policy →
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
