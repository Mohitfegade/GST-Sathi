/**
 * Centralized user-facing authentication messages, labels, button text, and error strings.
 *
 * Organized by domain (login, signup, forgotPassword, resetPassword, invite, common)
 * to enable localization into Hindi (hi) and Marathi (mr) in future phases
 * without altering application logic or component code.
 */

export const AUTH_MESSAGES = {
  login: {
    labels: {
      email: 'Email address',
      password: 'Password',
      otp: 'Verification code',
      rememberMe: 'Remember me',
    },
    buttons: {
      submitPassword: 'Sign in',
      sendOtp: 'Send verification code',
      verifyOtp: 'Verify and sign in',
      resendOtp: 'Resend code',
      useOtpInstead: 'Sign in with one-time code instead',
      usePasswordInstead: 'Sign in with password instead',
      forgotPassword: 'Forgot password?',
    },
    helpers: {
      otpSent: 'We sent a 6-digit verification code to your email.',
      otpExpiryNotice: 'The verification code expires in 10 minutes.',
      enterOtpPrompt: 'Enter the verification code sent to your email to continue.',
      needAccount: "Don't have an account? Sign up",
      signingIn: 'Signing in...',
      sendingOtp: 'Sending code...',
      verifyingOtp: 'Verifying code...',
    },
    errors: {
      invalidEmail: 'Please enter a valid email address.',
      passwordRequired: 'Password is required.',
      invalidCredentials: 'Invalid email or password.',
      invalidOtp: 'Invalid verification code. Please check and try again.',
      invalidOtpLength: 'Verification code must be 6 to 8 digits.',
      otpExpired: 'Verification code has expired. Please request a new one.',
      rateLimited: 'Too many attempts. Please wait a few minutes before trying again.',
      accountLocked: 'Account is temporarily locked. Please reset your password or contact support.',
      failed: 'Sign in failed. Please try again.',
    },
  },
  signup: {
    labels: {
      name: 'Full name',
      email: 'Email address',
      password: 'Password',
      firmName: 'CA / Tax Firm Name',
      agreeTerms: 'I agree to the Terms of Service and Privacy Policy',
    },
    buttons: {
      submit: 'Create Firm Account',
      alreadyHaveAccount: 'Already have an account? Sign in',
    },
    helpers: {
      passwordRequirements: 'Password must be at least 10 characters.',
      firmDescription: 'This will be the workspace name for your practice and client management.',
      creatingAccount: 'Creating your account...',
    },
    errors: {
      nameTooShort: 'Name must be at least 2 characters.',
      invalidEmail: 'Please enter a valid email address.',
      passwordTooShort: 'Password must be at least 10 characters.',
      firmNameTooShort: 'Firm name must be at least 2 characters.',
      mustAgreeTerms: 'You must agree to the Terms of Service and Privacy Policy to proceed.',
      emailAlreadyRegistered: 'An account with this email already exists. Try signing in instead.',
      failed: 'Failed to create your account. Please try again.',
    },
  },
  forgotPassword: {
    labels: {
      email: 'Email address',
    },
    buttons: {
      submit: 'Send reset link',
      backToLogin: 'Back to sign in',
    },
    messages: {
      instruction: 'Enter your registered email address and we will send you a password reset link.',
      success: 'If an account exists for this email, you will receive a password reset link shortly.',
      sending: 'Sending reset link...',
    },
    errors: {
      invalidEmail: 'Please enter a valid email address.',
      rateLimited: 'Too many password reset requests. Please wait a few minutes before trying again.',
      failed: 'Unable to send password reset link. Please try again.',
    },
  },
  resetPassword: {
    labels: {
      password: 'New password',
      confirmPassword: 'Confirm new password',
    },
    buttons: {
      submit: 'Reset password',
      backToLogin: 'Back to sign in',
    },
    messages: {
      instruction: 'Enter a new password for your account. It must be at least 10 characters.',
      success: 'Your password has been reset successfully. You can now sign in with your new password.',
      resetting: 'Resetting password...',
    },
    errors: {
      passwordTooShort: 'Password must be at least 10 characters.',
      confirmPasswordTooShort: 'Confirm password must be at least 10 characters.',
      passwordsDoNotMatch: 'Passwords do not match',
      invalidOrExpiredToken: 'This password reset link is invalid or has expired. Please request a new one.',
      failed: 'Unable to reset password. Please try again.',
    },
  },
  invite: {
    labels: {
      email: 'Email address',
      otp: 'Verification code',
      token: 'Invitation code',
    },
    buttons: {
      accept: 'Accept Invitation',
      requestNew: 'Request New Invite',
      goToLogin: 'Go to Sign In',
    },
    messages: {
      welcome: 'You have been invited to collaborate on GST Saathi.',
      instruction: 'Verify your email to accept this invitation and access your client portal.',
      success: 'Invitation accepted successfully! Redirecting to your portal...',
      accepting: 'Accepting invitation...',
    },
    states: {
      valid: 'This invitation is valid. Please verify your details below to continue.',
      invalid: 'This invitation link is invalid. Please check the link or ask your accountant to resend it.',
      expired: 'This invitation link has expired. Invitations are valid for 7 days. Please ask your accountant for a new invite.',
      used: 'This invitation has already been accepted. Please sign in to access your portal.',
    },
    errors: {
      tokenRequired: 'Invitation token is missing or invalid.',
      invalidEmail: 'Please enter a valid email address.',
      otpTooShort: 'Verification code must be at least 6 characters.',
      acceptanceFailed: 'Failed to accept invitation. Please check your verification code and try again.',
    },
  },
  common: {
    genericError: 'Something went wrong. Please try again.',
    networkError: 'Network connection error. Please check your internet connection and try again.',
    unauthorized: 'You must be signed in to perform this action.',
    forbidden: 'You do not have permission to access this resource.',
    notFound: 'The requested resource was not found.',
    loading: 'Loading, please wait...',
    sessionExpired: 'Your session has expired. Please sign in again.',
  },
} as const;

export type AuthMessages = typeof AUTH_MESSAGES;
