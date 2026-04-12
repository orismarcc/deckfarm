import { SignJWT, jwtVerify } from 'jose'
import type { User } from '@/types'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'deckfarm-secret-key-change-in-production'
)

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
