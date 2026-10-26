import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export const instant = false;

export default function NoAccessPage() {
  async function handleLogout() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg rounded-[12px] border border-line bg-surface p-6 sm:p-10 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          No access yet
        </h1>
        <p className="mt-4 text-[17px] text-muted leading-relaxed">
          Your account is active, but you are not currently assigned to an accounting firm or business portal. If you are an accountant, create a firm. If you are a business owner, please ask your accountant for an invite link.
        </p>
        <div className="mt-8 flex justify-center">
          <form action={handleLogout} className="w-full sm:w-auto">
            <Button type="submit" variant="primary" className="w-full sm:w-auto">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
