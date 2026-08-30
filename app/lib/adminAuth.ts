import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// WebAuthn relying party config — the "hidden" portal only works on these
// origins/rpID, both of which must match the domain it's actually served
// from in production.
export const RP_NAME = 'LyteApp Admin'
export const RP_ID = 'lyte-app.com'
export const RP_ORIGINS = ['https://lyte-app.com', 'https://www.lyte-app.com']

export const ADMIN_SESSION_COOKIE = 'lyte_admin_session'
export const ADMIN_CHALLENGE_COOKIE = 'lyte_admin_challenge'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export function isAllowedAdminEmail(email: string): boolean {
  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}

export async function getEmailFromBearer(token: string): Promise<string | null> {
  if (!token) return null
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
  if (error || !user?.email) return null
  return user.email
}

function sign(payload: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) throw new Error('ADMIN_SESSION_SECRET no configurado')
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createAdminSessionToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifyAdminSessionToken(token: string): string | null {
  try {
    const [payload, sig] = token.split('.')
    if (!payload || !sig) return null
    const expected = sign(payload)
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email: string; exp: number }
    if (Date.now() > data.exp) return null
    return data.email
  } catch {
    return null
  }
}

export function createChallengeToken(payload: Record<string, string>): string {
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${raw}.${sign(raw)}`
}

export function verifyChallengeToken(token: string): Record<string, string> | null {
  try {
    const [raw, sig] = token.split('.')
    if (!raw || !sig) return null
    const expected = sign(raw)
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Record<string, string>
  } catch {
    return null
  }
}
