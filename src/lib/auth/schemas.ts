import { z } from 'zod';
import { AUTH_MESSAGES } from './messages';

// ============================================================================
// Auth Validation Schemas
// ============================================================================

/**
 * Schema for CA / Tax accountant firm registration.
 * Creates both the accountant user account and the primary firm record.
 */
export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, AUTH_MESSAGES.signup.errors.nameTooShort),
  email: z
    .string()
    .trim()
    .email(AUTH_MESSAGES.signup.errors.invalidEmail),
  password: z
    .string()
    .min(10, AUTH_MESSAGES.signup.errors.passwordTooShort),
  firmName: z
    .string()
    .trim()
    .min(2, AUTH_MESSAGES.signup.errors.firmNameTooShort),
  agreeTerms: z.literal(true, {
    message: AUTH_MESSAGES.signup.errors.mustAgreeTerms,
  }),
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Schema for standard password-based login.
 */
export const loginPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email(AUTH_MESSAGES.login.errors.invalidEmail),
  password: z
    .string()
    .min(1, AUTH_MESSAGES.login.errors.passwordRequired),
  next: z.string().optional(),
});

export type LoginPasswordInput = z.infer<typeof loginPasswordSchema>;

/**
 * Schema for requesting a one-time password (OTP) email login code.
 */
export const loginOtpRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .email(AUTH_MESSAGES.login.errors.invalidEmail),
});

export type LoginOtpRequestInput = z.infer<typeof loginOtpRequestSchema>;

/**
 * Schema for verifying an OTP email login code.
 * Accepts 6 to 8 digit OTP codes sent by Supabase Auth.
 */
export const loginOtpVerifySchema = z.object({
  email: z
    .string()
    .trim()
    .email(AUTH_MESSAGES.login.errors.invalidEmail),
  token: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/, AUTH_MESSAGES.login.errors.invalidOtpLength),
  next: z.string().optional(),
});

export type LoginOtpVerifyInput = z.infer<typeof loginOtpVerifySchema>;

/**
 * Schema for requesting a password reset email link.
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email(AUTH_MESSAGES.forgotPassword.errors.invalidEmail),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Schema for setting a new password via reset link.
 * Requires minimum 10 characters and confirmation match.
 */
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, AUTH_MESSAGES.resetPassword.errors.passwordTooShort),
    confirmPassword: z
      .string()
      .min(10, AUTH_MESSAGES.resetPassword.errors.confirmPasswordTooShort),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: AUTH_MESSAGES.resetPassword.errors.passwordsDoNotMatch,
    path: ['confirmPassword'],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Schema for SME client invite acceptance.
 * Validates the invitation token, target email, and one-time verification code.
 */
export const inviteAcceptSchema = z.object({
  token: z
    .string()
    .trim()
    .min(1, AUTH_MESSAGES.invite.errors.tokenRequired),
  email: z
    .string()
    .trim()
    .email(AUTH_MESSAGES.invite.errors.invalidEmail),
  otp: z
    .string()
    .trim()
    .min(6, AUTH_MESSAGES.invite.errors.otpTooShort),
});

export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>;
