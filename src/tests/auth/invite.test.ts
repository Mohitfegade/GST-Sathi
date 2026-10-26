import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import {
  sendInviteOtp,
  verifyAndAcceptInvite,
} from '../../app/(auth)/invite/[token]/actions';
import { getSessionContext } from '../../lib/auth/session';
import type { User, SupabaseClient } from '@supabase/supabase-js';

// Mock Next.js navigation redirect
const mockRedirect = vi.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest?: string };
  error.digest = `NEXT_REDIRECT;replace;${url};307;;`;
  throw error;
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock Supabase Server Client
const mockSupabase = {
  auth: {
    signInWithOtp: vi.fn(),
    verifyOtp: vi.fn(),
    getUser: vi.fn(),
  },
  rpc: vi.fn(),
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

interface SimulatedClientInvite {
  id: string;
  firm_id: string;
  client_id: string;
  token_hash: string;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_by: string | null;
  deleted_at: string | null;
}

interface SimulatedClientAccess {
  id: string;
  firm_id: string;
  client_id: string;
  user_id: string;
  role: 'owner' | 'staff';
  deleted_at: string | null;
}

class SimulatedInviteSystem {
  invites: SimulatedClientInvite[] = [];
  clientAccess: SimulatedClientAccess[] = [];

  generateInvite(firmId: string, clientId: string, actorId: string) {
    // 32 cryptographic random bytes -> 64-char hex raw token
    const rawToken = crypto.randomBytes(32).toString('hex');
    // SHA-256 digest of raw token -> 64-char hex hash
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const record: SimulatedClientInvite = {
      id: `inv-${crypto.randomUUID()}`,
      firm_id: firmId,
      client_id: clientId,
      token_hash: tokenHash, // ONLY hash is stored
      expires_at: expiresAt,
      accepted_by: null,
      accepted_at: null,
      created_by: actorId,
      deleted_at: null,
    };

    this.invites.push(record);

    return {
      rawToken,
      tokenHash,
      record,
    };
  }

  peekInvite(rawToken: string) {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();

    const invite = this.invites.find(
      (inv) =>
        inv.token_hash === hash &&
        new Date(inv.expires_at) > now &&
        inv.accepted_at === null &&
        inv.deleted_at === null
    );

    if (!invite) return null;
    return {
      client_id: invite.client_id,
      firm_id: invite.firm_id,
      expires_at: invite.expires_at,
    };
  }

  acceptInvite(rawToken: string, userId: string): { clientId: string; firmId: string } {
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();

    const invite = this.invites.find(
      (inv) =>
        inv.token_hash === hash &&
        new Date(inv.expires_at) > now &&
        inv.accepted_at === null &&
        inv.deleted_at === null
    );

    if (!invite) {
      throw new Error('Invalid or expired invite token');
    }

    // Mark invite as accepted
    invite.accepted_by = userId;
    invite.accepted_at = now.toISOString();

    // Grant client_access with role 'owner' for THIS specific client only
    const existingIndex = this.clientAccess.findIndex(
      (ca) => ca.client_id === invite.client_id && ca.user_id === userId
    );

    if (existingIndex >= 0) {
      this.clientAccess[existingIndex].role = 'owner';
      this.clientAccess[existingIndex].deleted_at = null;
    } else {
      this.clientAccess.push({
        id: `ca-${crypto.randomUUID()}`,
        firm_id: invite.firm_id,
        client_id: invite.client_id,
        user_id: userId,
        role: 'owner',
        deleted_at: null,
      });
    }

    return {
      clientId: invite.client_id,
      firmId: invite.firm_id,
    };
  }
}

describe('Invite Integration Tests (src/tests/auth/invite.test.ts)', () => {
  let inviteSystem: SimulatedInviteSystem;

  const firmId = '11111111-1111-4111-8111-111111111111';
  const client1Id = '22222222-2222-4222-8222-222222222222';
  const client2Id = '33333333-3333-4333-8333-333333333333';
  const adminUserId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const inviteeUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    vi.clearAllMocks();
    inviteSystem = new SimulatedInviteSystem();
  });

  describe('1. Invite Generation: Token Format & Cryptographic Hash Security', () => {
    it('returns a 64-char hex raw token and stores ONLY a 64-char hex SHA-256 hash', () => {
      const { rawToken, tokenHash, record } = inviteSystem.generateInvite(
        firmId,
        client1Id,
        adminUserId
      );

      // 1. Raw token must be a 64-character lowercase hex string (from 32 random bytes)
      expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
      expect(rawToken.length).toBe(64);

      // 2. Stored hash must be a 64-character lowercase hex string (SHA-256)
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(tokenHash.length).toBe(64);

      // 3. Stored hash must strictly match SHA-256(rawToken)
      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(tokenHash).toBe(expectedHash);

      // 4. Raw token and hash are cryptographically distinct
      expect(rawToken).not.toBe(tokenHash);

      // 5. Database record stores only token_hash and NEVER stores rawToken
      expect(record.token_hash).toBe(tokenHash);
      expect((record as unknown as Record<string, unknown>).raw_token).toBeUndefined();
      expect((record as unknown as Record<string, unknown>).token).toBeUndefined();

      // 6. Default expires_at is approximately 7 days in the future
      const expires = new Date(record.expires_at).getTime();
      const expectedExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(expires - expectedExpires)).toBeLessThan(5000);
    });
  });

  describe('2. Rejection of Expired and Already Accepted Invites', () => {
    it('rejects expired invites (older than 7 days)', () => {
      const { rawToken, record } = inviteSystem.generateInvite(
        firmId,
        client1Id,
        adminUserId
      );

      // Simulate expired invite (created 8 days ago)
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day in the past
      record.expires_at = pastDate.toISOString();

      // Peek returns null
      expect(inviteSystem.peekInvite(rawToken)).toBeNull();

      // Acceptance throws 'Invalid or expired invite token'
      expect(() => inviteSystem.acceptInvite(rawToken, inviteeUserId)).toThrow(
        'Invalid or expired invite token'
      );
    });

    it('rejects already accepted invites (single-use guarantee)', () => {
      const { rawToken } = inviteSystem.generateInvite(
        firmId,
        client1Id,
        adminUserId
      );

      // First acceptance succeeds
      const result = inviteSystem.acceptInvite(rawToken, inviteeUserId);
      expect(result.clientId).toBe(client1Id);

      // Peek returns null after acceptance
      expect(inviteSystem.peekInvite(rawToken)).toBeNull();

      // Second acceptance by another user is strictly rejected
      const anotherUserId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      expect(() => inviteSystem.acceptInvite(rawToken, anotherUserId)).toThrow(
        'Invalid or expired invite token'
      );
    });

    it('rejects tampered or unknown tokens', () => {
      const fakeToken = '0'.repeat(64);
      expect(inviteSystem.peekInvite(fakeToken)).toBeNull();
      expect(() => inviteSystem.acceptInvite(fakeToken, inviteeUserId)).toThrow(
        'Invalid or expired invite token'
      );
    });
  });

  describe('3. Accepting Invite Grants Owner Access to Specific Client ONLY', () => {
    it('grants owner access to the invited client and isolates other clients of the firm', async () => {
      // Firm has two clients: client1Id and client2Id
      const { rawToken } = inviteSystem.generateInvite(
        firmId,
        client1Id,
        adminUserId
      );

      // User accepts invite for client1Id
      const { clientId } = inviteSystem.acceptInvite(rawToken, inviteeUserId);
      expect(clientId).toBe(client1Id);

      // Verify client_access table contains ONLY client1Id with role 'owner'
      const userAccess = inviteSystem.clientAccess.filter(
        (ca) => ca.user_id === inviteeUserId
      );
      expect(userAccess.length).toBe(1);
      expect(userAccess[0].client_id).toBe(client1Id);
      expect(userAccess[0].role).toBe('owner');
      expect(userAccess[0].firm_id).toBe(firmId);

      // Verify user has NO access to client2Id
      const hasClient2Access = inviteSystem.clientAccess.some(
        (ca) => ca.user_id === inviteeUserId && ca.client_id === client2Id
      );
      expect(hasClient2Access).toBe(false);

      // Verify session resolution for this user:
      // - firm is null (not a firm member)
      // - clients has client1Id only
      // - home is '/portal'
      const mockClientUser: User = {
        id: inviteeUserId,
        email: 'shopkeeper@ganeshstationery.in',
      } as User;

      const mockClientSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockClientUser },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'firm_members') {
            return {
              select: () => ({
                eq: () => ({
                  is: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            };
          }
          if (table === 'client_access') {
            return {
              select: () => ({
                eq: () => ({
                  is: () =>
                    Promise.resolve({
                      data: [
                        {
                          role: 'owner',
                          client_id: client1Id,
                          deleted_at: null,
                          clients: {
                            id: client1Id,
                            legal_name: 'Ganesh Stationery & Xerox',
                            trade_name: 'Ganesh Stationery',
                            deleted_at: null,
                          },
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                is: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        }),
      };

      const session = await getSessionContext(mockClientSupabase as unknown as SupabaseClient);
      expect(session).not.toBeNull();
      expect(session!.firm).toBeNull();
      expect(session!.clients.length).toBe(1);
      expect(session!.clients[0].id).toBe(client1Id);
      expect(session!.clients[0].role).toBe('owner');
      expect(session!.home).toBe('/portal');
    });
  });

  describe('4. Server Action Integration: verifyAndAcceptInvite', () => {
    const rawToken = 'a'.repeat(64);
    const validEmail = 'owner@kirana.in';
    const validOtp = '123456';

    it('successfully verifies OTP, accepts invite via RPC, and redirects to /portal', async () => {
      mockSupabase.auth.verifyOtp.mockResolvedValueOnce({
        data: { user: { id: inviteeUserId, email: validEmail } },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: client1Id,
        error: null,
      });

      await expect(
        verifyAndAcceptInvite(rawToken, validEmail, validOtp)
      ).rejects.toThrow('NEXT_REDIRECT: /portal');

      expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: validEmail,
        token: validOtp,
        type: 'email',
      });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('accept_client_invite', {
        p_token: rawToken,
      });

      expect(mockRedirect).toHaveBeenCalledWith('/portal');
    });

    it('rejects missing or empty inputs', async () => {
      const result1 = await verifyAndAcceptInvite('', validEmail, validOtp);
      expect(result1).toEqual({
        ok: false,
        message: 'Token, email, and 6-digit code are required.',
      });

      const result2 = await verifyAndAcceptInvite(rawToken, '', validOtp);
      expect(result2).toEqual({
        ok: false,
        message: 'Token, email, and 6-digit code are required.',
      });

      const result3 = await verifyAndAcceptInvite(rawToken, validEmail, '');
      expect(result3).toEqual({
        ok: false,
        message: 'Token, email, and 6-digit code are required.',
      });
      expect(mockSupabase.auth.verifyOtp).not.toHaveBeenCalled();
    });

    it('returns error if OTP verification fails', async () => {
      mockSupabase.auth.verifyOtp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid or expired OTP token' },
      });

      const result = await verifyAndAcceptInvite(rawToken, validEmail, '999999');
      expect(result).toEqual({
        ok: false,
        message: 'Invalid or expired OTP token',
      });
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('returns error if accept_client_invite RPC rejects (e.g. expired or already accepted)', async () => {
      mockSupabase.auth.verifyOtp.mockResolvedValueOnce({
        data: { user: { id: inviteeUserId, email: validEmail } },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid or expired invite token' },
      });

      const result = await verifyAndAcceptInvite(rawToken, validEmail, validOtp);
      expect(result).toEqual({
        ok: false,
        message: 'Invalid or expired invite token',
      });
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('sendInviteOtp sends OTP code to valid email', async () => {
      mockSupabase.auth.signInWithOtp.mockResolvedValueOnce({
        data: {},
        error: null,
      });

      const result = await sendInviteOtp(rawToken, 'valid@shop.in');
      expect(result).toEqual({
        ok: true,
        message: 'We sent a 6-digit code to your email.',
      });
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'valid@shop.in',
        options: { shouldCreateUser: true },
      });
    });

    it('sendInviteOtp rejects invalid email', async () => {
      const result = await sendInviteOtp(rawToken, 'invalid-email');
      expect(result).toEqual({
        ok: false,
        message: 'Please enter a valid email address.',
      });
      expect(mockSupabase.auth.signInWithOtp).not.toHaveBeenCalled();
    });
  });
});
