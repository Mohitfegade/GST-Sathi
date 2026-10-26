import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';
import { sendInviteOtpAction, verifyAndAcceptInviteAction } from './actions';

interface InvitePageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{
    step?: string;
    email?: string;
    error?: string;
    message?: string;
  }>;
}

interface InviteRecord {
  firm_name?: string;
  firm?: string;
  accounting_firm_name?: string;
  business_name?: string;
  client_name?: string;
  trade_name?: string;
  legal_name?: string;
}

export const instant = false;

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const currentStep = resolvedSearchParams.step === '2' ? '2' : '1';
  const currentEmail = resolvedSearchParams.email || '';
  const errorMessage = resolvedSearchParams.error || '';
  const successMessage =
    resolvedSearchParams.message || 'We sent a 6-digit code to your email.';

  const supabase = await createClient();
  const { data, error: rpcError } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc('peek_client_invite', {
    p_token: token,
  });

  const inviteData = data as unknown;
  const invite = (
    Array.isArray(inviteData)
      ? (inviteData.length > 0 ? inviteData[0] : null)
      : inviteData
  ) as InviteRecord | null;

  if (rpcError || !invite) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md rounded-[12px] border border-line bg-surface p-6 sm:p-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Invitation not found or expired
          </h1>
          <p className="mt-4 text-[17px] text-muted leading-relaxed">
            This invitation link is invalid or has expired. Please ask your accountant to send a new invite link.
          </p>
          <div className="mt-8 flex justify-center">
            <Button href="/login" variant="primary" className="w-full sm:w-auto">
              Go to login
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const firmName =
    invite.firm_name ||
    invite.firm ||
    invite.accounting_firm_name ||
    'Your accountant';

  const businessName =
    invite.business_name ||
    invite.client_name ||
    invite.trade_name ||
    invite.legal_name ||
    'your business';

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md rounded-[12px] border border-line bg-surface p-6 sm:p-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          {firmName} has invited you to share bills for {businessName}
        </h1>
        <p className="mt-4 text-[17px] text-muted leading-relaxed">
          Enter your email to receive a 6-digit sign-in code and access your portal.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mt-6 p-4 rounded-[8px] border border-line bg-background text-ink text-left text-sm"
          >
            {errorMessage}
          </div>
        )}

        {/* Step 1: Email field + Send code button */}
        <div id="step-1" className={currentStep === '2' ? 'hidden' : 'block'}>
          <form action={sendInviteOtpAction} className="mt-6 flex flex-col gap-4 text-left">
            <input type="hidden" name="token" value={token} />
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-ink mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={currentEmail}
                placeholder="name@company.com"
                className="w-full min-h-[48px] px-4 py-3 rounded-[8px] border border-line bg-background text-ink placeholder:text-muted text-[16px] focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
            <Button type="submit" variant="primary" className="w-full">
              Send code
            </Button>
          </form>
        </div>

        {/* Step 2: 6-digit code field + Verify & Accept Invite button */}
        <div id="step-2" className={currentStep === '2' ? 'block' : 'hidden'}>
          <div className="mt-6 p-4 rounded-[8px] border border-line bg-background text-left text-sm text-muted">
            {successMessage}
            {currentEmail && (
              <span className="block mt-1 font-medium text-ink">Sent to {currentEmail}</span>
            )}
          </div>

          <form action={verifyAndAcceptInviteAction} className="mt-4 flex flex-col gap-4 text-left">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="email" value={currentEmail} />
            <div>
              <label htmlFor="otp" className="block text-sm font-semibold text-ink mb-2">
                6-digit code
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="123456"
                className="w-full min-h-[48px] px-4 py-3 rounded-[8px] border border-line bg-background text-ink placeholder:text-muted text-[16px] tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
              />
            </div>
            <Button type="submit" variant="primary" className="w-full">
              Verify & Accept Invite
            </Button>
            <div className="text-center mt-2">
              <a
                href={`/invite/${token}`}
                className="inline-flex items-center justify-center min-h-[48px] text-sm font-medium text-muted hover:text-ink transition-colors"
              >
                Use a different email
              </a>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
