import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireFirmRole } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';

export const instant = false;

export const metadata: Metadata = {
  title: 'Accountant Workspace | GST Saathi',
  description: 'Manage clients and GST compliance.',
};

export default async function AccountantAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireFirmRole('staff');

  async function logoutAction() {
    'use server';
    const supabase = await createServerClient();
    await supabase.auth.signOut();
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background text-ink flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-on-accent focus:rounded-[8px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent font-medium text-sm"
      >
        Skip to main content
      </a>
      <header className="border-b border-line bg-background">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            <Link
              href="/app"
              className="text-xl font-bold tracking-tight text-ink hover:text-accent transition-colors min-h-[48px] inline-flex items-center"
            >
              GST Saathi
            </Link>
            <span className="inline-flex items-center rounded-full bg-surface px-3 py-1 text-xs sm:text-sm font-medium text-ink border border-line">
              {session.firm.name || 'Firm'}
            </span>

            <nav aria-label="Accountant workspace" className="flex items-center gap-1">
              <Link
                href="/app"
                className="min-h-[48px] inline-flex items-center px-3 py-2 text-sm font-medium text-ink hover:text-accent transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Home
              </Link>
              <Link
                href="/app/clients"
                className="min-h-[48px] inline-flex items-center px-3 py-2 text-sm font-medium text-ink hover:text-accent transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clients
              </Link>
            </nav>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <span
              className="text-sm font-medium text-muted truncate max-w-[160px] sm:max-w-xs"
              title={session.user.email ?? ''}
            >
              {session.user.email}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="min-h-[48px] px-4 py-2 rounded-lg text-sm font-medium bg-surface text-ink border border-line hover:bg-surface/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
