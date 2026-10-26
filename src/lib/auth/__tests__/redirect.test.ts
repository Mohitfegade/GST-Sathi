import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { getAuthRedirect, validateRedirectUrl } from '../redirect';
import type { SessionContext } from '../types';

describe('Auth Redirect & Route Protection', () => {
  const mockUser: User = {
    id: 'user-uuid-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  } as User;

  const firmAdminSession: SessionContext = {
    user: mockUser,
    firm: {
      id: 'firm-uuid-1',
      name: 'Alpha Tax Consultants',
      role: 'admin',
    },
    clients: [],
    home: '/app',
  };

  const firmStaffSession: SessionContext = {
    user: mockUser,
    firm: {
      id: 'firm-uuid-2',
      name: 'Beta Accounts',
      role: 'staff',
    },
    clients: [],
    home: '/app',
  };

  const clientOwnerSession: SessionContext = {
    user: mockUser,
    firm: null,
    clients: [
      {
        id: 'client-uuid-1',
        name: 'Acme Traders',
        role: 'owner',
      },
    ],
    home: '/portal',
  };

  const clientStaffSession: SessionContext = {
    user: mockUser,
    firm: null,
    clients: [
      {
        id: 'client-uuid-2',
        name: 'Acme Logistics',
        role: 'staff',
      },
    ],
    home: '/no-access',
  };

  const noAccessSession: SessionContext = {
    user: mockUser,
    firm: null,
    clients: [],
    home: '/no-access',
  };

  const dualAccessSession: SessionContext = {
    user: mockUser,
    firm: {
      id: 'firm-uuid-1',
      name: 'Alpha Tax Consultants',
      role: 'admin',
    },
    clients: [
      {
        id: 'client-uuid-1',
        name: 'Acme Traders',
        role: 'owner',
      },
    ],
    home: '/app',
  };

  describe('getAuthRedirect', () => {
    describe('unauthenticated visitor (session is null)', () => {
      it('redirects unauthenticated visitor accessing /app to /login?next=%2Fapp', () => {
        expect(getAuthRedirect('/app', null)).toBe('/login?next=%2Fapp');
      });

      it('redirects unauthenticated visitor accessing /app nested routes with URL-encoded next', () => {
        expect(getAuthRedirect('/app/purchases', null)).toBe(
          '/login?next=%2Fapp%2Fpurchases'
        );
        expect(getAuthRedirect('/app/clients/123/reconcile', null)).toBe(
          '/login?next=%2Fapp%2Fclients%2F123%2Freconcile'
        );
      });

      it('redirects unauthenticated visitor accessing /portal to /login?next=%2Fportal', () => {
        expect(getAuthRedirect('/portal', null)).toBe('/login?next=%2Fportal');
      });

      it('redirects unauthenticated visitor accessing /portal nested routes with URL-encoded next', () => {
        expect(getAuthRedirect('/portal/invoices', null)).toBe(
          '/login?next=%2Fportal%2Finvoices'
        );
      });

      it('redirects unauthenticated visitor accessing /no-access to /login', () => {
        expect(getAuthRedirect('/no-access', null)).toBe('/login');
        expect(getAuthRedirect('/no-access/', null)).toBe('/login');
      });

      it('allows unauthenticated visitor accessing public auth routes without redirect (returns null)', () => {
        expect(getAuthRedirect('/login', null)).toBeNull();
        expect(getAuthRedirect('/signup', null)).toBeNull();
        expect(getAuthRedirect('/forgot-password', null)).toBeNull();
        expect(getAuthRedirect('/reset-password', null)).toBeNull();
      });

      it('allows unauthenticated visitor accessing public non-auth routes without redirect (returns null)', () => {
        expect(getAuthRedirect('/', null)).toBeNull();
        expect(getAuthRedirect('/terms', null)).toBeNull();
        expect(getAuthRedirect('/privacy', null)).toBeNull();
        expect(getAuthRedirect('/invite/abc-token', null)).toBeNull();
        expect(getAuthRedirect('/invite/team/join', null)).toBeNull();
      });
    });

    describe('firm member (firm is present, home is /app)', () => {
      it('redirects firm member accessing /login to /app', () => {
        expect(getAuthRedirect('/login', firmAdminSession)).toBe('/app');
        expect(getAuthRedirect('/login', firmStaffSession)).toBe('/app');
      });

      it('redirects firm member accessing other public auth routes to /app', () => {
        expect(getAuthRedirect('/signup', firmAdminSession)).toBe('/app');
        expect(getAuthRedirect('/forgot-password', firmAdminSession)).toBe('/app');
        expect(getAuthRedirect('/reset-password', firmAdminSession)).toBe('/app');
      });

      it('allows firm member accessing /app or /app nested routes (returns null)', () => {
        expect(getAuthRedirect('/app', firmAdminSession)).toBeNull();
        expect(getAuthRedirect('/app/overview', firmAdminSession)).toBeNull();
        expect(getAuthRedirect('/app/reconciliation', firmStaffSession)).toBeNull();
      });

      it('redirects firm member accessing /portal to /app (when not client owner)', () => {
        expect(getAuthRedirect('/portal', firmAdminSession)).toBe('/app');
        expect(getAuthRedirect('/portal/invoices', firmStaffSession)).toBe('/app');
      });

      it('redirects firm member accessing /no-access to /app', () => {
        expect(getAuthRedirect('/no-access', firmAdminSession)).toBe('/app');
        expect(getAuthRedirect('/no-access', firmStaffSession)).toBe('/app');
      });

      it('allows firm member accessing general public routes (returns null)', () => {
        expect(getAuthRedirect('/', firmAdminSession)).toBeNull();
        expect(getAuthRedirect('/terms', firmAdminSession)).toBeNull();
        expect(getAuthRedirect('/privacy', firmAdminSession)).toBeNull();
        expect(getAuthRedirect('/invite/new-invite', firmAdminSession)).toBeNull();
      });
    });

    describe('client owner (no firm, client owner, home is /portal)', () => {
      it('redirects client owner accessing /login to /portal', () => {
        expect(getAuthRedirect('/login', clientOwnerSession)).toBe('/portal');
      });

      it('redirects client owner accessing other public auth routes to /portal', () => {
        expect(getAuthRedirect('/signup', clientOwnerSession)).toBe('/portal');
        expect(getAuthRedirect('/forgot-password', clientOwnerSession)).toBe('/portal');
        expect(getAuthRedirect('/reset-password', clientOwnerSession)).toBe('/portal');
      });

      it('allows client owner accessing /portal or /portal nested routes (returns null)', () => {
        expect(getAuthRedirect('/portal', clientOwnerSession)).toBeNull();
        expect(getAuthRedirect('/portal/invoices', clientOwnerSession)).toBeNull();
        expect(getAuthRedirect('/portal/upload', clientOwnerSession)).toBeNull();
      });

      it('redirects client owner accessing /app to /portal (due to !session.firm)', () => {
        expect(getAuthRedirect('/app', clientOwnerSession)).toBe('/portal');
        expect(getAuthRedirect('/app/settings', clientOwnerSession)).toBe('/portal');
      });

      it('redirects client owner accessing /no-access to /portal', () => {
        expect(getAuthRedirect('/no-access', clientOwnerSession)).toBe('/portal');
      });

      it('allows client owner accessing general public routes (returns null)', () => {
        expect(getAuthRedirect('/', clientOwnerSession)).toBeNull();
        expect(getAuthRedirect('/terms', clientOwnerSession)).toBeNull();
        expect(getAuthRedirect('/privacy', clientOwnerSession)).toBeNull();
        expect(getAuthRedirect('/invite/client-invite', clientOwnerSession)).toBeNull();
      });
    });

    describe('user with neither (no firm, no client owner, home is /no-access)', () => {
      it('redirects user with neither accessing /app to /no-access', () => {
        expect(getAuthRedirect('/app', noAccessSession)).toBe('/no-access');
        expect(getAuthRedirect('/app/clients', noAccessSession)).toBe('/no-access');
      });

      it('redirects user with neither accessing /portal to /no-access', () => {
        expect(getAuthRedirect('/portal', noAccessSession)).toBe('/no-access');
        expect(getAuthRedirect('/portal/invoices', noAccessSession)).toBe('/no-access');
      });

      it('redirects user with neither accessing /login to /no-access', () => {
        expect(getAuthRedirect('/login', noAccessSession)).toBe('/no-access');
      });

      it('allows user with neither accessing /no-access without redirect (returns null)', () => {
        expect(getAuthRedirect('/no-access', noAccessSession)).toBeNull();
      });

      it('allows user with neither accessing general public routes (returns null)', () => {
        expect(getAuthRedirect('/', noAccessSession)).toBeNull();
        expect(getAuthRedirect('/terms', noAccessSession)).toBeNull();
        expect(getAuthRedirect('/privacy', noAccessSession)).toBeNull();
        expect(getAuthRedirect('/invite/code', noAccessSession)).toBeNull();
      });
    });

    describe('client staff (staff role on client, no firm, home is /no-access)', () => {
      it('redirects client staff without owner role accessing /portal to /no-access', () => {
        expect(getAuthRedirect('/portal', clientStaffSession)).toBe('/no-access');
      });

      it('redirects client staff accessing /app to /no-access', () => {
        expect(getAuthRedirect('/app', clientStaffSession)).toBe('/no-access');
      });

      it('redirects client staff accessing /no-access to /no-access (or stays on /no-access)', () => {
        // Since clients.length > 0, rule redirects to session.home which is /no-access
        expect(getAuthRedirect('/no-access', clientStaffSession)).toBe('/no-access');
      });
    });

    describe('user with dual membership (firm admin and client owner)', () => {
      it('allows accessing both /app and /portal without redirects', () => {
        expect(getAuthRedirect('/app', dualAccessSession)).toBeNull();
        expect(getAuthRedirect('/app/dashboard', dualAccessSession)).toBeNull();
        expect(getAuthRedirect('/portal', dualAccessSession)).toBeNull();
        expect(getAuthRedirect('/portal/invoices', dualAccessSession)).toBeNull();
      });

      it('redirects to home (/app) when accessing /login', () => {
        expect(getAuthRedirect('/login', dualAccessSession)).toBe('/app');
      });
    });
  });

  describe('validateRedirectUrl', () => {
    describe('open redirect attack prevention', () => {
      it('rejects absolute external URLs with protocol', () => {
        expect(validateRedirectUrl('https://evil.com')).toBe('/app');
        expect(validateRedirectUrl('http://evil.com')).toBe('/app');
        expect(validateRedirectUrl('ftp://evil.com')).toBe('/app');
      });

      it('rejects protocol-relative URLs (//evil.com)', () => {
        expect(validateRedirectUrl('//evil.com')).toBe('/app');
        expect(validateRedirectUrl('///evil.com')).toBe('/app');
        expect(validateRedirectUrl('////attacker.com/path')).toBe('/app');
      });

      it('rejects backslash-based relative evasion (/\\evil.com)', () => {
        expect(validateRedirectUrl('/\\evil.com')).toBe('/app');
        expect(validateRedirectUrl('/\\/evil.com')).toBe('/app');
      });

      it('rejects scheme-based attacks without initial slashes (javascript:, data:)', () => {
        expect(validateRedirectUrl('javascript:alert(1)')).toBe('/app');
        expect(validateRedirectUrl('javascript:window.location="https://evil.com"')).toBe('/app');
        expect(validateRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('/app');
        expect(validateRedirectUrl('vbscript:msgbox(1)')).toBe('/app');
      });

      it('rejects urls starting with backslash without slash (\\evil.com)', () => {
        expect(validateRedirectUrl('\\evil.com')).toBe('/app');
      });

      it('rejects CRLF / header injection attempts', () => {
        expect(validateRedirectUrl('/app\r\nSet-Cookie: evil=1')).toBe('/app');
        expect(validateRedirectUrl('/portal\nLocation: https://evil.com')).toBe('/app');
      });
    });

    describe('custom fallback support', () => {
      it('returns custom fallback when validation fails', () => {
        expect(validateRedirectUrl('https://evil.com', '/portal')).toBe('/portal');
        expect(validateRedirectUrl('//evil.com', '/no-access')).toBe('/no-access');
        expect(validateRedirectUrl('javascript:alert(1)', '/login')).toBe('/login');
        expect(validateRedirectUrl(null, '/portal')).toBe('/portal');
        expect(validateRedirectUrl(undefined, '/portal')).toBe('/portal');
      });
    });

    describe('empty or invalid input handling', () => {
      it('falls back on null or undefined input', () => {
        expect(validateRedirectUrl(null)).toBe('/app');
        expect(validateRedirectUrl(undefined)).toBe('/app');
      });

      it('falls back on empty or whitespace strings', () => {
        expect(validateRedirectUrl('')).toBe('/app');
        expect(validateRedirectUrl('   ')).toBe('/app');
      });
    });

    describe('valid internal path handling', () => {
      it('accepts valid root-relative paths', () => {
        expect(validateRedirectUrl('/app')).toBe('/app');
        expect(validateRedirectUrl('/app/purchases')).toBe('/app/purchases');
        expect(validateRedirectUrl('/portal')).toBe('/portal');
        expect(validateRedirectUrl('/portal/invoices')).toBe('/portal/invoices');
        expect(validateRedirectUrl('/terms')).toBe('/terms');
      });

      it('accepts valid paths with query parameters and fragments', () => {
        expect(validateRedirectUrl('/app?tab=settings')).toBe('/app?tab=settings');
        expect(validateRedirectUrl('/portal/invoices?period=2026-04&status=pending')).toBe(
          '/portal/invoices?period=2026-04&status=pending'
        );
        expect(validateRedirectUrl('/app#section-1')).toBe('/app#section-1');
      });
    });
  });
});
