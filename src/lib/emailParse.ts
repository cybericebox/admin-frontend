// Shared email validation for the invite flow (typed chips, paste, CSV).

// HTML5-level validation — deliberately permissive (the backend is the real
// authority). Rejects whitespace and obvious non-addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s)
}
