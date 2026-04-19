/**
 * Structured server-side logger.
 * Automatically redacts sensitive fields so they
 * never appear in logs, monitoring tools, or crash reports.
 */

type LogLevel = 'info' | 'warn' | 'error'

const SENSITIVE_KEYS = [
  'senha', 'password', 'token', 'secret', 'key',
  'authorization', 'hash', 'credential', 'api_key',
  'database_url', 'jwt', 'bearer', 'service_role',
  'private', 'cookie', 'session', 'refresh', 'access_token',
]

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase()
    if (SENSITIVE_KEYS.some(s => lower.includes(s))) {
      out[k] = '[REDACTED]'
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redact(v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

export function log(
  level: LogLevel,
  event: string,
  data: Record<string, unknown> = {}
) {
  const entry = {
    level,
    event,
    ts: new Date().toISOString(),
    ...redact(data),
  }

  const msg = JSON.stringify(entry)
  if (level === 'error') console.error(msg)
  else if (level === 'warn') console.warn(msg)
  else console.log(msg)
}

/** Convenience aliases */
export const logger = {
  info: (event: string, data?: Record<string, unknown>) => log('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => log('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => log('error', event, data),
}
