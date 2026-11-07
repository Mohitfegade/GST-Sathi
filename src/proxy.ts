import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptionsWithName } from '@supabase/ssr';
import { env } from '@/lib/env';
import { getAuthRedirect } from '@/lib/auth/redirect';
import { getSessionContext } from '@/lib/auth/session';
import type { SessionContext, AuthFirm, AuthClient, HomeRoute } from '@/lib/auth/types';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: CookieOptionsWithName;
          }>
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session cookies and retrieve authenticated user if an auth token exists
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some((c) =>
    c.name.startsWith('sb-') && c.name.includes('-auth-token')
  );

  let user = null;
  if (hasAuthCookie) {
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      user = null;
    }
  }

  let session: SessionContext | null = null;

  if (user) {
    // Resolve session role/home using metadata if present, or query via getSessionContext
    const metaFirm = (user.app_metadata?.firm || user.user_metadata?.firm) as
      | AuthFirm
      | undefined;
    const metaClients = (user.app_metadata?.clients || user.user_metadata?.clients) as
      | AuthClient[]
      | undefined;
    const metaHome = (user.app_metadata?.home || user.user_metadata?.home) as
      | HomeRoute
      | undefined;

    if (metaFirm !== undefined || metaClients !== undefined || metaHome !== undefined) {
      const firm = metaFirm ?? null;
      const clients = metaClients ?? [];
      let home: HomeRoute = metaHome ?? '/no-access';
      if (!metaHome) {
        if (firm !== null) {
          home = '/app';
        } else if (clients.some((c) => c.role === 'owner')) {
          home = '/portal';
        }
      }
      session = {
        user,
        firm,
        clients,
        home,
      };
    } else {
      session = await getSessionContext(supabase);
    }
  } else {
    const { isDemoMode } = await import('@/lib/env');
    if (isDemoMode) {
      const pathname = request.nextUrl.pathname;
      if (pathname.startsWith('/app') || pathname.startsWith('/portal')) {
        const { DEV_MOCK_SESSION } = await import('@/lib/auth/dev-mock');
        session = DEV_MOCK_SESSION;
      }
    }
  }

  const targetUrl = getAuthRedirect(request.nextUrl.pathname, session);

  if (targetUrl) {
    const redirectResponse = NextResponse.redirect(new URL(targetUrl, request.url));
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}

export default proxy;
