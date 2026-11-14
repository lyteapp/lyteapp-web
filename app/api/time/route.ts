import { connection } from 'next/server'

// The server's clock, for keeping the kiosks' welcome videos in step: each
// kiosk measures how far its own clock is from this one, so they all agree
// on "now" even when the tablets' clocks don't.
export async function GET() {
  await connection()
  return Response.json({ now: Date.now() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
