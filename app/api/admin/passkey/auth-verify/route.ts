import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import {
  RP_ID, RP_ORIGINS, ADMIN_CHALLENGE_COOKIE, ADMIN_SESSION_COOKIE,
  isAllowedAdminEmail, verifyChallengeToken, createAdminSessionToken, errorMessage,
} from '../../../../lib/adminAuth'

export async function POST(req: NextRequest) {
  try {
    const challengeCookie = req.cookies.get(ADMIN_CHALLENGE_COOKIE)?.value
    const challengeData = challengeCookie ? verifyChallengeToken(challengeCookie) : null
    if (!challengeData?.challenge) {
      return NextResponse.json({ error: 'Reto de autenticacion invalido o expirado' }, { status: 400 })
    }

    const body = await req.json()
    const credentialId: string | undefined = body?.response?.id
    if (!credentialId) {
      return NextResponse.json({ error: 'Respuesta invalida' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data: row, error: rowErr } = await supabaseAdmin
      .from('admin_passkeys').select('*').eq('credential_id', credentialId).maybeSingle()
    if (rowErr) throw rowErr
    if (!row || !isAllowedAdminEmail(row.email)) {
      return NextResponse.json({ error: 'Dispositivo no reconocido' }, { status: 401 })
    }

    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: RP_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: row.credential_id,
        publicKey: isoBase64URL.toBuffer(row.public_key),
        counter: row.counter,
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'No se pudo verificar Face ID' }, { status: 401 })
    }

    await supabaseAdmin.from('admin_passkeys')
      .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq('credential_id', credentialId)

    const res = NextResponse.json({ verified: true })
    res.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(row.email), {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60,
    })
    res.cookies.delete(ADMIN_CHALLENGE_COOKIE)
    return res
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}
