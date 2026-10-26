import type { SessionContext } from './types';

/**
 * Public authentication routes where logged-in users are redirected to their home route.
 */
export const PUBLIC_AUTH_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
] as const;

/**
 * All public routes accessible without authentication.
 */
export const PUBLIC_ROUTES = [
  ...PUBLIC_AUTH_ROUTES,
  '/invite',
  '/terms',
  '/privacy',
  '/',
] as const;

/**
 * Pure function to determine auth redirects based on the requested pathname and session context.
 *
 * Route protection rules:
 * - Public auth routes (/login, /signup, /forgot-password, /reset-password):
 *   - Authenticated: redirect to `session.home`.
 *   - Unauthenticated: return `null` (allow access).
 * - `/app` routes (starts with `/app`):
 *   - Unauthenticated: redirect to `/login?next=${encodeURIComponent(pathname)}`.
 *   - Authenticated without firm: redirect to `session.home`.
 *   - Authenticated with firm: return `null` (allow access).
 * - `/portal` routes (starts with `/portal`):
 *   - Unauthenticated: redirect to `/login?next=${encodeURIComponent(pathname)}`.
 *   - Authenticated without client owner role: redirect to `session.home`.
 *   - Authenticated client owner: return `null` (allow access).
 * - `/no-access` route (starts with `/no-access`):
 *   - Unauthenticated: redirect to `/login`.
 *   - Authenticated with firm or clients: redirect to `session.home`.
 *   - Authenticated with neither: return `null` (allow access).
 * - All other routes (/terms, /privacy, /, /invite/:path*, etc.):
 *   - return `null` (allow access).
 */
export function getAuthRedirect(
  pathname: string,
  session: SessionContext | null
): string | null {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.replace(/\/+$/, '')
      : pathname;

  // 1. Public auth routes (/login, /signup, /forgot-password, /reset-password)
  const isPublicAuth = PUBLIC_AUTH_ROUTES.includes(
    normalized as (typeof PUBLIC_AUTH_ROUTES)[number]
  );
  if (isPublicAuth) {
    if (session !== null) {
      return session.home;
    }
    return null;
  }

  // 2. Firm portal routes (/app)
  if (normalized === '/app' || normalized.startsWith('/app/')) {
    if (!session) {
      return `/login?next=${encodeURIComponent(pathname)}`;
    }
    if (!session.firm) {
      return session.home;
    }
    return null;
  }

  // 3. Client portal routes (/portal)
  if (normalized === '/portal' || normalized.startsWith('/portal/')) {
    if (!session) {
      return `/login?next=${encodeURIComponent(pathname)}`;
    }
    if (!session.clients.some((c) => c.role === 'owner')) {
      return session.home;
    }
    return null;
  }

  // 4. No access routes (/no-access)
  if (normalized === '/no-access' || normalized.startsWith('/no-access/')) {
    if (!session) {
      return '/login';
    }
    if (session.firm || session.clients.length > 0) {
      return session.home;
    }
    return null;
  }

  // 5. Otherwise: allow access (e.g. /, /terms, /privacy, /invite/:path*)
  return null;
}

/**
 * Validates a redirect URL to prevent open redirect vulnerabilities.
 * Ensures the target URL is an internal path on the same origin.
 *
 * Rules:
 * - Must start with `/`
 * - Must NOT start with `//` or `/\`
 * - Must NOT contain `:` before any slash (prevents scheme execution like `javascript:`)
 * - Returns the valid path or the fallback (defaults to `/app`)
 */
export function validateRedirectUrl(
  url: string | null | undefined,
  fallback: string = '/app'
): string {
  if (!url || typeof url !== 'string') {
    return fallback;
  }

  const trimmed = url.trim();

  // Must start with '/'
  if (!trimmed.startsWith('/')) {
    return fallback;
  }

  // Must NOT start with '//' or '/\'
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }

  // Must NOT contain ':' before any slash
  const firstSlashIndex = trimmed.indexOf('/');
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex !== -1 && (firstSlashIndex === -1 || colonIndex < firstSlashIndex)) {
    return fallback;
  }

  // Prevent newline / control character injection
  if (/[\r\n\0]/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}
