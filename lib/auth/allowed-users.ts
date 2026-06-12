const ALLOWED_AUTH_EMAILS = new Set(['kirommoussa@gmail.com'])

export function isAllowedAuthEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ALLOWED_AUTH_EMAILS.has(email.trim().toLowerCase())
}

export function unauthorizedAuthMessage(): string {
  return 'Access is restricted. Sign in is not available for this account.'
}
