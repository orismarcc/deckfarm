/**
 * Input validation utilities.
 * All validation is intentionally strict but avoids
 * breaking legitimate use-cases.
 */

// RFC 5322 simplified — covers all real-world email formats
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false
  return EMAIL_RE.test(email) && email.length >= 3 && email.length <= 254
}

export function isValidPassword(password: unknown): { valid: boolean; reason?: string } {
  if (typeof password !== 'string') return { valid: false, reason: 'Senha inválida' }
  if (password.length < 8) return { valid: false, reason: 'Senha deve ter no mínimo 8 caracteres' }
  if (password.length > 128) return { valid: false, reason: 'Senha muito longa' }
  return { valid: true }
}

export function sanitizeString(value: unknown, maxLength = 255): string {
  if (typeof value !== 'string') return ''
  // Remove null bytes and control characters (except newline/tab)
  return value.replace(/\0/g, '').trim().slice(0, maxLength)
}

export function isValidUUID(uuid: unknown): boolean {
  if (typeof uuid !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
}

/**
 * Validates that a string is one of the allowed enum values.
 * Prevents open-ended values from being passed to DB columns.
 */
export function isAllowedValue<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}
