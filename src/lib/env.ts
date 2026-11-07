import { z } from 'zod';

const isServer = typeof window === 'undefined';

/**
 * Zod schema for client and server environment variables.
 */
export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL')
    .default('https://placeholder-project.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY must not be empty')
    .default('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholderKey'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY must not be empty')
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url('NEXT_PUBLIC_SITE_URL must be a valid URL')
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  NEXT_PUBLIC_DEMO_MODE: z.string().optional(),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type Env = z.infer<typeof envSchema>;

const rawEnv = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholderKey',
  SUPABASE_SERVICE_ROLE_KEY: isServer
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : undefined,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  NODE_ENV: process.env.NODE_ENV,
};

function resolveEnv(): Env {
  const result = envSchema.safeParse(rawEnv);

  if (result.success) {
    return result.data;
  }

  // Fallback for development / test / non-production / demo:
  return {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholderKey',
    SUPABASE_SERVICE_ROLE_KEY: isServer
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : undefined,
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) || 'development',
  };
}

export const env = resolveEnv();

export function getEnv(): Env {
  return env;
}

export const isDemoMode: boolean =
  process.env.NODE_ENV !== 'test' &&
  (process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('127.0.0.1') ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder'));
