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
      <header className="border-b border-line bg-background">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="text-xl font-bold tracking-tight text-ink hover:text-accent transition-colors"
            >
              GST Saathi
            </Link>
            <span className="inline-flex items-center rounded-full bg-surface px-3 py-1 text-sm font-medium text-ink border border-line">
              {session.firm.name || 'Firm'}
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4">
            <span
              className="text-sm font-medium text-muted truncate max-w-[200px] sm:max-w-xs"
              title={session.user.email ?? ''}
            >
              {session.user.email}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="min-h-[48px] px-4 py-2 rounded-lg text-sm font-medium bg-surface text-ink border border-line hover:bg-background transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
