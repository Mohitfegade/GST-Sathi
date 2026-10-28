import type { Metadata } from 'next';
import Link from 'next/link';
import { requireFirmRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/clients/actions';
import { ClientFormFields } from '@/components/clients/ClientFormFields';

export const instant = false;

export const metadata: Metadata = {
  title: 'Add Client | GST Saathi',
  description: 'Add a new client business for GST compliance management.',
};

export default async function NewClientPage() {
  // Ensure authenticated firm member (staff or admin)
  await requireFirmRole('staff');

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/clients"
          className="inline-flex items-center text-sm font-medium text-muted hover:text-ink transition-colors min-h-[48px] py-2"
        >
          ← Back to clients
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mt-2">
          Add a client business
        </h1>
        <p className="text-muted text-base mt-1">
          Enter the business details. You can invite the owner to share bills after adding.
        </p>
      </div>

      <ClientFormFields submitAction={createClient} submitLabel="Add client" />
    </div>
  );
}
