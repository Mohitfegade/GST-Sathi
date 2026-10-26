import type { User } from '@supabase/supabase-js';

export interface AuthFirm {
  id: string;
  name: string;
  role: 'admin' | 'staff';
}

export interface AuthClient {
  id: string;
  name: string;
  role: 'owner' | 'staff';
}

export type HomeRoute = '/app' | '/portal' | '/no-access';

export interface SessionContext {
  user: User;
  firm: AuthFirm | null;
  clients: AuthClient[];
  home: HomeRoute;
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; message: string; field?: string };
