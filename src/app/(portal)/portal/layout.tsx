import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireClientAccess } from '@/lib/auth/roles';
import { createServerClient } from '@/lib/supabase/server';

export const instant = false;

async function handleLogout() {
  'use server';
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireClientAccess();

  const businessName =
    session.currentClient?.name ||
    (session.clients.length > 0 ? session.clients[0].name : '');
  const userEmail = session.user.email ?? '';

  return (
    <div className="min-h-screen bg-background text-ink flex flex-col">
      <header className="border-b border-line bg-background sticky top-0 z-10">
        <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 sm:py-0 sm:h-16 gap-3 sm:gap-4">
            {/* Left: GST Saathi + Business Name */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Link
                href="/portal"
                className="text-lg sm:text-xl font-bold tracking-tight text-ink hover:text-accent transition-colors shrink-0"
              >
                GST Saathi
              </Link>
              {businessName ? (
                <>
                  <span className="text-line select-none" aria-hidden="true">
                    /
                  </span>
                  <span className="text-sm sm:text-base font-medium text-muted truncate max-w-[150px] sm:max-w-[240px] md:max-w-none">
                    {businessName}
                  </span>
                </>
              ) : null}
            </div>

            {/* Right: User Email + Log out Button */}
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
              <span
                className="text-xs sm:text-sm text-muted truncate max-w-[160px] sm:max-w-[220px]"
                title={userEmail}
              >
                {userEmail}
              </span>
              <form action={handleLogout}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center min-h-[48px] px-4 py-2 rounded-lg text-sm font-medium text-ink bg-surface border border-line hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors cursor-pointer"
                >
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
