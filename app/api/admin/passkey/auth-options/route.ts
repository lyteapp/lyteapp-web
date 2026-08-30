import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { RP_ID, ADMIN_CHALLENGE_COOKIE, createChallengeToken, errorMessage } from '../../../../lib/adminAuth'

export async function POST() {
  try {
    // No allowCredentials — this is a discoverable-credential (resident key)
    // flow, so the device itself offers up whichever passkey matches this
    // site without the user having to type an email first.
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
    })

    const res = NextResponse.json({ options })
    res.cookies.set(ADMIN_CHALLENGE_COOKIE, createChallengeToken({ challenge: options.challenge }), {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 300,
    })
    return res
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}
