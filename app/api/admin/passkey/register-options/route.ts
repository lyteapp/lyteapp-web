import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import {
  RP_NAME, RP_ID, ADMIN_CHALLENGE_COOKIE,
  isAllowedAdminEmail, getEmailFromBearer, verifyAdminSessionToken,
  createChallengeToken, ADMIN_SESSION_COOKIE,
} from '../../../../lib/adminAuth'

export async function POST(req: NextRequest) {
  try {
    // Registering a new passkey requires already being an authenticated,
    // allowlisted admin — either via a normal Supabase session (first ever
    // device) or an existing passkey session (adding another device).
    const bearer = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
    const cookieSession = req.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? ''
    const email = (bearer && await getEmailFromBearer(bearer))
      || (cookieSession && verifyAdminSessionToken(cookieSession))
      || null
    if (!email || !isAllowedAdminEmail(email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data: existing } = await supabaseAdmin
      .from('admin_passkeys').select('credential_id').eq('email', email)

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: email,
      userDisplayName: email,
      attestationType: 'none',
      excludeCredentials: (existing ?? []).map(c => ({ id: c.credential_id })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
    })

    const res = NextResponse.json({ options })
    res.cookies.set(ADMIN_CHALLENGE_COOKIE, createChallengeToken({ challenge: options.challenge, email }), {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 300,
    })
    return res
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
