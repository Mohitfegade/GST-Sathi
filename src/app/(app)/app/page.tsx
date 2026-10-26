import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Workspaces | GST Saathi',
  description: 'Manage GST returns and purchase bills for your clients.',
};

export default function AccountantAppPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Client Workspaces
        </h1>
        <p className="mt-2 text-lg text-muted sm:text-xl">
          Manage GST returns and purchase bills for your clients.
        </p>
      </div>

      <section
        aria-label="Client workspaces empty state"
        className="rounded-xl border border-line bg-surface p-8 text-center sm:p-12"
      >
        <div className="mx-auto max-w-lg space-y-3">
          <p className="text-xl font-semibold text-ink sm:text-2xl">
            Your clients will appear here.
          </p>
          <p className="text-base text-ink sm:text-lg">
            Invite a business owner to share their purchase and sales bills before the deadline.
          </p>
          <p className="text-sm text-muted sm:text-base">
            Client onboarding and return preparation will be available here.
          </p>
        </div>
      </section>
    </div>
  );
}
