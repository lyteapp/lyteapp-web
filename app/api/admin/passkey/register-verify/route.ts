import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import {
  RP_ID, RP_ORIGINS, ADMIN_CHALLENGE_COOKIE,
  isAllowedAdminEmail, verifyChallengeToken,
} from '../../../../lib/adminAuth'

export async function POST(req: NextRequest) {
  try {
    const challengeCookie = req.cookies.get(ADMIN_CHALLENGE_COOKIE)?.value
    const challengeData = challengeCookie ? verifyChallengeToken(challengeCookie) : null
    if (!challengeData?.challenge || !challengeData.email || !isAllowedAdminEmail(challengeData.email)) {
      return NextResponse.json({ error: 'Reto de registro invalido o expirado' }, { status: 400 })
    }

    const body = await req.json()
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: RP_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'No se pudo verificar el dispositivo' }, { status: 400 })
    }

    const { credential } = verification.registrationInfo
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { persistSession: false } }
    )
    const { error: insertErr } = await supabaseAdmin.from('admin_passkeys').insert({
      email: challengeData.email,
      credential_id: credential.id,
      public_key: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      device_name: typeof body.deviceName === 'string' ? body.deviceName.slice(0, 80) : null,
    })
    if (insertErr) throw insertErr

    const res = NextResponse.json({ verified: true })
    res.cookies.delete(ADMIN_CHALLENGE_COOKIE)
    return res
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
