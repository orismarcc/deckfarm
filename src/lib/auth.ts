import { SignJWT, jwtVerify } from 'jose'
import type { User } from '@/types'

function resolveJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[auth] JWT_SECRET is required in production. Set it as an environment variable.')
    }
    // Development-only fallback — clearly labelled so it's never accidentally used in prod
    console.warn('[auth] JWT_SECRET not configured — using dev fallback. Set JWT_SECRET in .env.local')
    return new TextEncoder().encode('__dev_only_fallback__set_JWT_SECRET_in_env__')
  }
  if (secret.length < 32) {
    throw new Error('[auth] JWT_SECRET must be at least 32 characters long.')
  }
  return new TextEncoder().encode(secret)
}

const JWT_SECRET = resolveJwtSecret()

export async function signToken(payload: Omit<User, 'senha'>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<Omit<User, 'senha'> | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as Omit<User, 'senha'>
  } catch {
    return null
  }
}

export function getTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}
