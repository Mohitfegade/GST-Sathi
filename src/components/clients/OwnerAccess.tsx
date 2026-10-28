'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  createClientInviteAction,
  revokeClientInviteAction,
  getClientOwnerAccessData,
  type ClientOwnerAccessData,
  type ClientOwner,
  type ClientPendingInvite,
} from '@/lib/clients/invite-actions';

// ============================================================================
// Types
// ============================================================================

export interface OwnerAccessProps {
  clientId: string;
  isFirmAdmin?: boolean;
  initialData?: ClientOwnerAccessData;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

// ============================================================================
// Component
// ============================================================================

export function OwnerAccess({
  clientId,
  isFirmAdmin: initialIsFirmAdmin,
  initialData,
}: OwnerAccessProps) {
  const [data, setData] = useState<ClientOwnerAccessData | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);

  // Invite generation state
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Invite revocation state
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Asynchronous refresh callback for user actions
  const refreshData = useCallback(async () => {
    try {
      const res = await getClientOwnerAccessData(clientId);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load access details.');
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  // Initial load effect
  useEffect(() => {
    let isCancelled = false;

    if (!initialData) {
      getClientOwnerAccessData(clientId)
        .then((res) => {
          if (!isCancelled) {
            setData(res);
            setIsLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (!isCancelled) {
            setError(err instanceof Error ? err.message : 'Failed to load access details.');
            setIsLoading(false);
          }
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [clientId, initialData]);

  // Determine admin rights
  const isAdmin = initialIsFirmAdmin ?? data?.isFirmAdmin ?? false;
  const owners: ClientOwner[] = data?.owners ?? [];
  const pendingInvites: ClientPendingInvite[] = data?.pendingInvites ?? [];

  // Handle invite generation
  const handleCreateInvite = async () => {
    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await createClientInviteAction(clientId);
      if (res.ok) {
        setGeneratedInviteUrl(res.data.inviteUrl);
        setCopied(false);
        // Refresh the list to reflect newly issued pending invite
        await refreshData();
      } else {
        setCreateError(res.message);
      }
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to generate invitation.');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle clipboard copy
  const handleCopy = async () => {
    if (!resolvedInviteUrl) return;
    try {
      await navigator.clipboard.writeText(resolvedInviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(false);
    }
  };

  // Handle invite revocation
  const handleRevoke = async (inviteId: string) => {
    setRevokingId(inviteId);
    setRevokeError(null);

    try {
      const res = await revokeClientInviteAction(inviteId);
      if (res.ok) {
        setConfirmRevokeId(null);
        await refreshData();
      } else {
        setRevokeError(res.message);
      }
    } catch (err: unknown) {
      setRevokeError(err instanceof Error ? err.message : 'Failed to revoke invite.');
    } finally {
      setRevokingId(null);
    }
  };

  // Resolve absolute URL for display and sharing
  const resolvedInviteUrl = (() => {
    if (!generatedInviteUrl) return '';
    if (
      generatedInviteUrl.startsWith('http://') ||
      generatedInviteUrl.startsWith('https://')
    ) {
      return generatedInviteUrl;
    }
    if (typeof window !== 'undefined') {
      const origin = window.location.origin.replace(/\/+$/, '');
      const path = generatedInviteUrl.startsWith('/')
        ? generatedInviteUrl
        : `/${generatedInviteUrl}`;
      return `${origin}${path}`;
    }
    return generatedInviteUrl;
  })();

  const whatsAppShareUrl = `https://wa.me/?text=${encodeURIComponent(
    'Hello! Here is your private link to share your GST bills with our accounting firm on GST Saathi: ' +
      resolvedInviteUrl
  )}`;

  return (
    <div className="bg-background border border-line rounded-[12px] p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-bold text-ink leading-tight">
          Shop Owner Portal Access
        </h2>
        <p className="text-[15px] text-muted leading-normal mt-1">
          Invite the shop owner so they can upload bills and view filed returns directly.
        </p>
      </div>

      {/* Staff Permission Notice */}
      {!isAdmin && (
        <div className="p-4 bg-surface border border-line rounded-[8px] text-[15px] text-muted min-h-[48px] flex items-center">
          Only firm admins can create or revoke invite links.
        </div>
      )}

      {/* Admin Create Action */}
      {isAdmin && !generatedInviteUrl && (
        <div>
          <button
            type="button"
            disabled={isCreating}
            onClick={handleCreateInvite}
            aria-label="Create invite link"
            className="min-h-[48px] px-6 py-3 rounded-[8px] text-[16px] font-medium bg-accent text-on-accent hover:bg-accent-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 inline-flex items-center justify-center"
          >
            {isCreating ? 'Creating invite link...' : 'Create invite link'}
          </button>

          {createError && (
            <p className="mt-3 text-[14px] text-ink bg-surface border border-line p-3 rounded-[8px]">
              {createError}
            </p>
          )}
        </div>
      )}

      {/* ONE-TIME Banner when invite is generated */}
      {generatedInviteUrl && (
        <div className="p-5 bg-surface border border-line rounded-[10px] space-y-4">
          <div className="space-y-1">
            <span className="text-[13px] font-semibold text-ink uppercase tracking-wider">
              Invitation Link Created
            </span>
            <p className="text-[15px] font-medium text-ink bg-background border border-line p-3 rounded-[8px]">
              This link will only be shown once. Copy it now and send it to the business owner.
            </p>
          </div>

          {/* URL text display */}
          <div className="p-3 bg-background border border-line rounded-[8px] font-mono text-[14px] text-ink break-all select-all min-h-[48px] flex items-center">
            {resolvedInviteUrl}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy invitation link"
              className="min-h-[48px] px-6 py-3 rounded-[8px] text-[15px] font-medium bg-accent text-on-accent hover:bg-accent-hover transition-colors inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>

            <a
              href={whatsAppShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on WhatsApp"
              className="min-h-[48px] px-6 py-3 rounded-[8px] text-[15px] font-medium bg-background text-ink border border-line hover:bg-surface transition-colors inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Share on WhatsApp
            </a>

            <button
              type="button"
              onClick={() => setGeneratedInviteUrl(null)}
              aria-label="Done"
              className="min-h-[48px] px-4 py-2 rounded-[8px] text-[14px] font-medium text-muted hover:text-ink transition-colors ml-auto inline-flex items-center justify-center"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-surface border border-line rounded-[8px] text-[14px] text-ink">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-4 text-[15px] text-muted min-h-[48px] flex items-center">
          Loading access details...
        </div>
      )}

      {/* Section: Active Owners */}
      <div className="space-y-3 pt-2 border-t border-line">
        <h3 className="text-[17px] font-semibold text-ink">Active Owners</h3>

        {owners.length > 0 ? (
          <ul className="divide-y divide-line border border-line rounded-[8px] overflow-hidden bg-background">
            {owners.map((owner) => (
              <li
                key={owner.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-h-[48px]"
              >
                <div>
                  <p className="font-medium text-ink text-[15px]">
                    {owner.email || `Shop Owner (${owner.userId.slice(0, 8)})`}
                  </p>
                  <p className="text-[13px] text-muted mt-0.5">
                    Access granted on {formatDate(owner.createdAt)}
                  </p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-[6px] text-[13px] font-medium bg-surface text-ink border border-line self-start sm:self-auto min-h-[32px]">
                  Active
                </span>
              </li>
            ))}
          </ul>
        ) : (
          !isLoading && (
            <p className="text-[14px] text-muted py-1">
              No active shop owners yet.
            </p>
          )
        )}
      </div>

      {/* Section: Pending Invites */}
      <div className="space-y-3 pt-2 border-t border-line">
        <h3 className="text-[17px] font-semibold text-ink">Pending Invites</h3>

        {revokeError && (
          <p className="text-[14px] text-ink bg-surface border border-line p-3 rounded-[8px]">
            {revokeError}
          </p>
        )}

        {pendingInvites.length > 0 ? (
          <ul className="divide-y divide-line border border-line rounded-[8px] overflow-hidden bg-background">
            {pendingInvites.map((invite) => {
              const expiryText =
                invite.daysRemaining === 1
                  ? 'Expires in 1 day'
                  : invite.daysRemaining === 0
                  ? 'Expires today'
                  : `Expires in ${invite.daysRemaining} days`;

              const isConfirming = confirmRevokeId === invite.id;
              const isRevoking = revokingId === invite.id;

              return (
                <li
                  key={invite.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-h-[48px]"
                >
                  <div>
                    <p className="font-medium text-ink text-[15px]">
                      Invitation Link
                    </p>
                    <p className="text-[13px] text-muted mt-0.5">
                      Created on {formatDate(invite.createdAt)} &bull; {expiryText}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="self-start sm:self-auto">
                      {isConfirming ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-muted hidden md:inline">
                            Revoke this invite?
                          </span>
                          <button
                            type="button"
                            disabled={isRevoking}
                            onClick={() => handleRevoke(invite.id)}
                            aria-label="Confirm revoke invite"
                            className="min-h-[48px] px-4 py-2 rounded-[8px] text-[14px] font-medium bg-background text-ink border border-line hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 inline-flex items-center justify-center"
                          >
                            {isRevoking ? 'Revoking...' : 'Yes, revoke'}
                          </button>
                          <button
                            type="button"
                            disabled={isRevoking}
                            onClick={() => setConfirmRevokeId(null)}
                            aria-label="Cancel revoke invite"
                            className="min-h-[48px] px-4 py-2 rounded-[8px] text-[14px] font-medium text-muted hover:text-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent inline-flex items-center justify-center"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRevokeId(invite.id)}
                          aria-label="Revoke invitation"
                          className="min-h-[48px] px-4 py-2 rounded-[8px] text-[14px] font-medium bg-background text-ink border border-line hover:bg-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent inline-flex items-center justify-center"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          !isLoading && (
            <p className="text-[14px] text-muted py-1">
              No pending invitations.
            </p>
          )
        )}
      </div>
    </div>
  );
}

export default OwnerAccess;
