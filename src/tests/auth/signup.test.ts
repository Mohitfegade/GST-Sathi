import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signUpAction } from '../../app/(auth)/signup/actions';
import { signupSchema } from '../../lib/auth/schemas';
import type { User } from '@supabase/supabase-js';

// Mock Next.js navigation redirect
const mockRedirect = vi.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT: ${url}`) as Error & { digest?: string };
  error.digest = `NEXT_REDIRECT;replace;${url};307;;`;
  throw error;
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Mock Supabase Server Client & Admin Client
const mockSupabase = {
  auth: {
    signUp: vi.fn(),
  },
  rpc: vi.fn(),
};

const mockAdminClient = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

function createSignupFormData(data: {
  name?: string;
  email?: string;
  password?: string;
  firmName?: string;
  agreeTerms?: string | null;
}): FormData {
  const formData = new FormData();
  if (data.name !== undefined) formData.append('name', data.name);
  if (data.email !== undefined) formData.append('email', data.email);
  if (data.password !== undefined) formData.append('password', data.password);
  if (data.firmName !== undefined) formData.append('firmName', data.firmName);
  if (data.agreeTerms !== undefined && data.agreeTerms !== null) {
    formData.append('agreeTerms', data.agreeTerms);
  }
  return formData;
}

describe('Signup Integration Tests (src/tests/auth/signup.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Field Validation Enforcement', () => {
    it('enforces required full name', async () => {
      const formData = createSignupFormData({
        name: '',
        email: 'ca.verma@example.com',
        password: 'SecurePassword123!',
        firmName: 'Verma & Associates',
        agreeTerms: 'on',
      });

      const result = await signUpAction(null, formData);
      expect(result).toEqual({
        ok: false,
        message: 'Please enter your full name.',
        field: 'name',
      });
      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
    });

    describe('Email format validation', () => {
      it('rejects missing or empty email', async () => {
        const formData = createSignupFormData({
          name: 'CA Rajesh Verma',
          email: '',
          password: 'SecurePassword123!',
          firmName: 'Verma & Associates',
          agreeTerms: 'on',
        });

        const result = await signUpAction(null, formData);
        expect(result).toEqual({
          ok: false,
          message: 'Please enter a valid email address.',
          field: 'email',
        });
        expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
      });

      it.each([
        'notanemail',
        'missing-at-sign.com',
        'user@',
        '@domain.com',
        'user@domain',
        'spaces in@email.com',
      ])('rejects invalid email format: %s', async (invalidEmail) => {
        const formData = createSignupFormData({
          name: 'CA Rajesh Verma',
          email: invalidEmail,
          password: 'SecurePassword123!',
          firmName: 'Verma & Associates',
          agreeTerms: 'on',
        });

        const result = await signUpAction(null, formData);
        expect(result).toEqual({
          ok: false,
          message: 'Please enter a valid email address.',
          field: 'email',
        });
        expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
      });
    });

    describe('Password length enforcement (min 10 characters)', () => {
      it.each([
        '',
        '1',
        'short',
        'pass123',
        '123456789', // 9 chars
      ])('rejects password shorter than 10 characters (%s)', async (shortPassword) => {
        const formData = createSignupFormData({
          name: 'CA Rajesh Verma',
          email: 'ca.verma@example.com',
          password: shortPassword,
          firmName: 'Verma & Associates',
          agreeTerms: 'on',
        });

        const result = await signUpAction(null, formData);
        expect(result).toEqual({
          ok: false,
          message: 'Password must be at least 10 characters long.',
          field: 'password',
        });
        expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
      });

      it('accepts password of exactly 10 characters', async () => {
        mockSupabase.auth.signUp.mockResolvedValueOnce({
          data: { user: { id: 'usr-123', email: 'ca.verma@example.com' } },
          error: null,
        });
        mockSupabase.rpc.mockResolvedValueOnce({
          data: 'firm-123',
          error: null,
        });

        const formData = createSignupFormData({
          name: 'CA Rajesh Verma',
          email: 'ca.verma@example.com',
          password: '1234567890', // exactly 10 chars
          firmName: 'Verma & Associates',
          agreeTerms: 'on',
        });

        await expect(signUpAction(null, formData)).rejects.toThrow('NEXT_REDIRECT: /app');
        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
          email: 'ca.verma@example.com',
          password: '1234567890',
          options: {
            data: { full_name: 'CA Rajesh Verma' },
          },
        });
      });
    });

    describe('Firm name validation', () => {
      it('rejects missing or whitespace-only firm name', async () => {
        const formData = createSignupFormData({
          name: 'CA Rajesh Verma',
          email: 'ca.verma@example.com',
          password: 'SecurePassword123!',
          firmName: '   ',
          agreeTerms: 'on',
        });

        const result = await signUpAction(null, formData);
        expect(result).toEqual({
          ok: false,
          message: 'Please enter your accounting firm or practice name.',
          field: 'firmName',
        });
        expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
      });
    });

    describe('Terms of service agreement validation', () => {
      it.each([
        null,
        '',
        'off',
        'false',
        '0',
        'no',
      ])('rejects unaccepted terms: %s', async (unaccepted) => {
        const formData = createSignupFormData({
          name: 'CA Rajesh Verma',
          email: 'ca.verma@example.com',
          password: 'SecurePassword123!',
          firmName: 'Verma & Associates',
          agreeTerms: unaccepted,
        });

        const result = await signUpAction(null, formData);
        expect(result).toEqual({
          ok: false,
          message: 'You must agree to the Terms of Service and Privacy Policy to continue.',
          field: 'agreeTerms',
        });
        expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
      });

      it.each(['on', 'true', 'yes', '1'])('accepts truthy terms agreement: %s', async (val) => {
        mockSupabase.auth.signUp.mockResolvedValueOnce({
          data: { user: { id: 'usr-123', email: 'ca.verma@example.com' } },
          error: null,
        });
        mockSupabase.rpc.mockResolvedValueOnce({
          data: 'firm-123',
          error: null,
        });

        const formData = createSignupFormData({
          name: 'CA Rajesh Verma',
          email: 'ca.verma@example.com',
          password: 'SecurePassword123!',
          firmName: 'Verma & Associates',
          agreeTerms: val,
        });

        await expect(signUpAction(null, formData)).rejects.toThrow('NEXT_REDIRECT: /app');
      });
    });

    describe('signupSchema Zod contract parity', () => {
      it('validates correct input schema successfully', () => {
        const valid = signupSchema.safeParse({
          name: 'CA Rajesh Verma',
          email: 'ca.verma@example.com',
          password: 'SecurePassword123!',
          firmName: 'Verma & Associates',
          agreeTerms: true,
        });
        expect(valid.success).toBe(true);
      });

      it('fails Zod validation for password < 10 chars', () => {
        const invalid = signupSchema.safeParse({
          name: 'CA Rajesh Verma',
          email: 'ca.verma@example.com',
          password: '123456789',
          firmName: 'Verma & Associates',
          agreeTerms: true,
        });
        expect(invalid.success).toBe(false);
      });

      it('fails Zod validation when terms agreement is not strictly true', () => {
        const invalid = signupSchema.safeParse({
          name: 'CA Rajesh Verma',
          email: 'ca.verma@example.com',
          password: 'SecurePassword123!',
          firmName: 'Verma & Associates',
          agreeTerms: false,
        });
        expect(invalid.success).toBe(false);
      });
    });
  });

  describe('2. Successful Signup & Firm Creation with Admin Role', () => {
    it('calls create_firm_with_admin RPC and sets user role to admin on successful signup', async () => {
      const mockUser = { id: 'usr-ca-123', email: 'ca.patel@taxfirm.in' } as User;

      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: 'firm-new-uuid',
        error: null,
      });

      const formData = createSignupFormData({
        name: 'CA Anand Patel',
        email: 'ca.patel@taxfirm.in',
        password: 'UltraSecurePassword999',
        firmName: 'Patel Tax Advisory',
        agreeTerms: 'on',
      });

      await expect(signUpAction(null, formData)).rejects.toThrow('NEXT_REDIRECT: /app');

      // 1. Verifies auth.signUp was called with correct arguments
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'ca.patel@taxfirm.in',
        password: 'UltraSecurePassword999',
        options: {
          data: { full_name: 'CA Anand Patel' },
        },
      });

      // 2. Verifies create_firm_with_admin was invoked with firm_name
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_firm_with_admin', {
        firm_name: 'Patel Tax Advisory',
      });

      // 3. Verifies redirect to /app
      expect(mockRedirect).toHaveBeenCalledWith('/app');
    });

    it('provisions firm and sets user role to admin via adminClient fallback if RPC returns error', async () => {
      const mockUser = { id: 'usr-ca-456', email: 'ca.sharma@taxfirm.in' } as User;

      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      // RPC not yet migrated or fails
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: new Error('function public.create_firm_with_admin does not exist'),
      });

      // Fallback adminClient calls:
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'firm-fallback-uuid' },
        error: null,
      });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsertFirm = vi.fn().mockReturnValue({ select: mockSelect });

      const mockInsertMember = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'firms') {
          return { insert: mockInsertFirm };
        }
        if (table === 'firm_members') {
          return { insert: mockInsertMember };
        }
        return {};
      });

      const formData = createSignupFormData({
        name: 'CA Priya Sharma',
        email: 'ca.sharma@taxfirm.in',
        password: 'UltraSecurePassword999',
        firmName: 'Sharma Financials',
        agreeTerms: 'on',
      });

      await expect(signUpAction(null, formData)).rejects.toThrow('NEXT_REDIRECT: /app');

      // Verifies firm creation with created_by set to user id
      expect(mockInsertFirm).toHaveBeenCalledWith({
        name: 'Sharma Financials',
        created_by: 'usr-ca-456',
      });

      // Verifies firm_members creation with role strictly set to admin
      expect(mockInsertMember).toHaveBeenCalledWith({
        firm_id: 'firm-fallback-uuid',
        user_id: 'usr-ca-456',
        role: 'admin',
      });

      expect(mockRedirect).toHaveBeenCalledWith('/app');
    });

    it('returns error when auth signup fails', async () => {
      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'User already registered' },
      });

      const formData = createSignupFormData({
        name: 'CA Existing User',
        email: 'existing@taxfirm.in',
        password: 'SuperSecret1234',
        firmName: 'Existing Practice',
        agreeTerms: 'on',
      });

      const result = await signUpAction(null, formData);

      expect(result).toEqual({
        ok: false,
        message: 'User already registered',
      });
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('returns error if both RPC and admin fallback fail', async () => {
      mockSupabase.auth.signUp.mockResolvedValueOnce({
        data: { user: { id: 'usr-ca-789', email: 'ca.error@taxfirm.in' } },
        error: null,
      });

      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC execution failed' },
      });

      // Fallback fails as well
      mockAdminClient.from.mockImplementation(() => {
        throw new Error('Admin client unconfigured');
      });

      const formData = createSignupFormData({
        name: 'CA Error Case',
        email: 'ca.error@taxfirm.in',
        password: 'SuperSecret1234',
        firmName: 'Error Practice',
        agreeTerms: 'on',
      });

      const result = await signUpAction(null, formData);

      expect(result).toEqual({
        ok: false,
        message: 'RPC execution failed',
      });
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});
