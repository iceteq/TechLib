/** Allowed signup emails: @onitio.com, plus grandfathered admin. */
export const SIGNUP_ALLOWED_DOMAIN = 'onitio.com';
export const SIGNUP_EMAIL_EXCEPTIONS = ['anton.liampa@outlook.com'] as const;

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True if this email may create a new account. Sign-in is unrestricted. */
export function isSignupEmailAllowed(email: string): boolean {
  const normalized = normalizeSignupEmail(email);
  if (!normalized.includes('@')) return false;
  if (
    (SIGNUP_EMAIL_EXCEPTIONS as readonly string[]).includes(normalized)
  ) {
    return true;
  }
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at !== normalized.indexOf('@')) return false;
  const domain = normalized.slice(at + 1);
  return domain === SIGNUP_ALLOWED_DOMAIN;
}

export const SIGNUP_EMAIL_DENIED_MESSAGE =
  'Signups are limited to @onitio.com email addresses.';
