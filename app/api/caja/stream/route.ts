export const dynamic    = 'force-dynamic'
export const maxDuration = 300

import { createClient } from '@supabase/supabase-js'

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
)

type Cajera = { id: string; name: string; pin: string }

async function verifyPin(storeId: string, pin: string): Promise<boolean> {
  const { data: store } = await supa
    .from('stores')
    .select('checkout_settings')
    .eq('id', storeId)
    .maybeSingle()

  if (!store) return false

  const cs = (store.checkout_settings as Record<string, unknown>) ?? {}
  const cajeras = (cs.cajeros as Cajera[] | undefined) ?? []

  if (cajeras.length > 0) return cajeras.some(c => c.pin === pin)

  const cajeroPIN = cs.cajeroPIN as string | undefined
  if (cajeroPIN && cajeroPIN.trim() !== '') return cajeroPIN === pin

  return true
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get('storeId')
  if (!storeId) return new Response('Missing storeId', { status: 400 })

  const pin = req.headers.get('x-cajero-pin') ?? ''
  const ok = await verifyPin(storeId, pin)
  if (!ok) return new Response('Unauthorized', { status: 401 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch { /* client disconnected */ }
      }

      send({ type: 'connected' })

      const channel = supa
        .channel(`caja-stream-${storeId}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
          () => send({ type: 'change' })
        )
        .subscribe()

      // Heartbeat every 20s to keep the connection alive through proxies
      const heartbeat = setInterval(() => send({ type: 'ping' }), 20000)

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        supa.removeChannel(channel)
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
