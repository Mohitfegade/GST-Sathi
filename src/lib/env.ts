import { z } from 'zod';

const isServer = typeof window === 'undefined';

/**
 * Zod schema for client and server environment variables.
 */
export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY must not be empty'),
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
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type Env = z.infer<typeof envSchema>;

const rawEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: isServer
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : undefined,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
};

function resolveEnv(): Env {
  const result = envSchema.safeParse(rawEnv);

  if (result.success) {
    return result.data;
  }

  // Safe parsing with fallback or runtime exception on invalid server configuration:
  const issues = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');

  if (isServer && process.env.NODE_ENV === 'production') {
    throw new Error(
      `[env] Critical server configuration error: Invalid environment variables: ${issues}`
    );
  }

  // Fallback for development / test / non-production:
  return {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyPlaceholderAnonKeyForLocalDevOnly',
    SUPABASE_SERVICE_ROLE_KEY: isServer
      ? process.env.SUPABASE_SERVICE_ROLE_KEY
      : undefined,
    NEXT_PUBLIC_SITE_URL:
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) || 'development',
  };
}

export const env = resolveEnv();

export function getEnv(): Env {
  return env;
}
