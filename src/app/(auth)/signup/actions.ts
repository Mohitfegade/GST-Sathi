'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/auth/types';

interface SignupDatabase {
  public: {
    Tables: {
      firms: {
        Row: {
          id: string;
          name: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      firm_members: {
        Row: {
          id: string;
          firm_id: string;
          user_id: string;
          role: 'admin' | 'staff';
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          firm_id: string;
          user_id: string;
          role?: 'admin' | 'staff';
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          firm_id?: string;
          user_id?: string;
          role?: 'admin' | 'staff';
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_firm_with_admin: {
        Args: {
          firm_name: string;
        };
        Returns: unknown;
      };
    };
    Enums: {
      firm_role: 'admin' | 'staff';
    };
    CompositeTypes: Record<string, never>;
  };
}

export async function signUpAction(
  prevState: ActionResult | null | undefined,
  formData: FormData
): Promise<ActionResult> {
  const name = (formData.get('name') as string)?.trim() || '';
  const email = (formData.get('email') as string)?.trim().toLowerCase() || '';
  const password = (formData.get('password') as string) || '';
  const firmName = (formData.get('firmName') as string)?.trim() || '';
  const agreeTerms = formData.get('agreeTerms');

  // 1. Validation
  if (!name) {
    return {
      ok: false,
      message: 'Please enter your full name.',
      field: 'name',
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return {
      ok: false,
      message: 'Please enter a valid email address.',
      field: 'email',
    };
  }

  if (!password || password.length < 10) {
    return {
      ok: false,
      message: 'Password must be at least 10 characters long.',
      field: 'password',
    };
  }

  if (!firmName) {
    return {
      ok: false,
      message: 'Please enter your accounting firm or practice name.',
      field: 'firmName',
    };
  }

  const isAgreed =
    agreeTerms === 'on' ||
    agreeTerms === 'true' ||
    agreeTerms === 'yes' ||
    agreeTerms === '1';

  if (!isAgreed) {
    return {
      ok: false,
      message: 'You must agree to the Terms of Service and Privacy Policy to continue.',
      field: 'agreeTerms',
    };
  }

  // 2. Supabase Auth Sign Up
  const supabase = await createServerClient<SignupDatabase>();
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  });

  if (authError) {
    return {
      ok: false,
      message: authError.message,
    };
  }

  if (!authData?.user) {
    return {
      ok: false,
      message: 'Unable to create user account. Please try again.',
    };
  }

  // 3. Create firm with admin via RPC create_firm_with_admin
  const { error: rpcError } = await supabase.rpc('create_firm_with_admin', {
    firm_name: firmName,
  });

  if (rpcError) {
    // If the RPC function is not installed in the database yet, attempt fallback
    // using the admin client to ensure the firm and admin membership are provisioned.
    let fallbackSuccess = false;

    if (authData.user.id) {
      try {
        const adminClient = createAdminClient<SignupDatabase>();
        const { data: newFirm, error: firmErr } = await adminClient
          .from('firms')
          .insert({
            name: firmName,
            created_by: authData.user.id,
          })
          .select('id')
          .single();

        if (!firmErr && newFirm) {
          const { error: memberErr } = await adminClient
            .from('firm_members')
            .insert({
              firm_id: newFirm.id,
              user_id: authData.user.id,
              role: 'admin',
            });

          if (!memberErr) {
            fallbackSuccess = true;
          }
        }
      } catch {
        // Fallback not available or admin client unconfigured
      }
    }

    if (!fallbackSuccess) {
      return {
        ok: false,
        message: rpcError.message,
      };
    }
  }

  // 4. On success: redirect to /app
  redirect('/app');
}
