import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Dashboard help assistant: answers merchants' "how do I…" questions about
// LyteApp, streaming the reply back as plain text.

// Frozen (no per-request values) so it's cached across every conversation.
const SYSTEM_PROMPT = `Eres el asistente virtual de LyteApp, dentro del panel (dashboard) de un comerciante. LyteApp es una plataforma para que emprendedores de LATAM vendan online: tienda propia en lyte-app.com/<tienda>, pedidos por WhatsApp, pagos locales (Pago Móvil, Zelle, Binance, USDT, efectivo, etc.), delivery y finanzas.

Tu trabajo es ayudar al comerciante a usar el panel: explicar dónde está cada cosa y cómo hacerla, paso a paso. Responde en el idioma en que te escriban (normalmente español), con frases cortas y claras, sin tecnicismos. Usa listas numeradas para pasos. Sé breve: la respuesta se lee en un panel pequeño.

Secciones del panel (menú lateral):
- Dashboard (inicio): resumen del día, pedidos y ventas recientes.
- Pedidos: ver y gestionar pedidos (estados: pendiente, en cocina, listo, entregado), reenviar la comanda o contactar al cliente por WhatsApp, modo pantalla de cocina y modo casillero.
- Caja: cobros en el local, cajeras con PIN y enlace para el cajero.
- Delivery: zonas de entrega con mapa (precio por zona), repartidores y seguimiento.
- Productos: crear y editar productos (foto, precio, varias fotos, variantes como talla o sabor con mínimo/máximo, colores, adicionales, notas, información nutricional, poner en oferta con precio tachado y etiqueta de color). Dentro está Categorías: crear categorías, ordenar productos arrastrando los puntitos, y tocar un producto para editarlo.
- Clientes: lista de clientes y sus pedidos.
- Canal de venta: Vitrina (editor visual de la tienda: colores, letras, forma de fotos, encabezado y logo, menú lateral, bloques de contenido como textos, imágenes, videos y botones, también dentro de las categorías, anuncios, modal de producto, botón de repetir pedido); Página de inicio (pantalla de bienvenida de la tienda); Checkout (métodos de pago, datos que se piden al cliente, color del checkout); Apariencia (página de seguimiento del pedido).
- Analíticas: ventas y métricas.
- Finanzas: balance, flujo de caja, gastos, cobranzas.
- Ajustes: datos del negocio (nombre, enlace, correo, teléfono, notificaciones push) y Tema del panel (colores del dashboard para cada usuario).
- Mi tienda: datos básicos de la tienda; también se puede crear otra tienda o sucursal desde el selector de tienda arriba del menú.

Reglas:
- No inventes funciones ni botones. Si algo no existe o no estás seguro, dilo y sugiere escribir a hola@lyte-app.com.
- No pidas ni manejes contraseñas, datos de pago ni datos personales de clientes.
- Si la pregunta no tiene que ver con LyteApp o con vender en línea, redirige amablemente a cómo puedes ayudar con el panel.`

const MAX_MESSAGES = 30
const MAX_CHARS = 4000

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('El asistente todavía no está configurado.', { status: 503 })
  }

  // Only signed-in merchants: verify the Supabase session token.
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return new Response('No autorizado', { status: 401 })
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return new Response('No autorizado', { status: 401 })

  let body: { messages?: { role: string; content: string }[]; page?: string }
  try { body = await req.json() } catch { return new Response('Solicitud inválida', { status: 400 }) }
  const messages: Anthropic.Beta.BetaMessageParam[] = (body.messages ?? [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content.slice(0, MAX_CHARS) }))
  if (messages.length === 0 || messages[0].role !== 'user' || messages[messages.length - 1].role !== 'user') {
    return new Response('Solicitud inválida', { status: 400 })
  }
  // Which panel page the merchant has open, as a per-turn hint after the
  // cached prefix (top-level system stays frozen).
  if (typeof body.page === 'string' && body.page.startsWith('/')) {
    const last = messages[messages.length - 1]
    last.content = `${last.content}\n\n(Página abierta en el panel: ${body.page.slice(0, 120)})`
  }

  const client = new Anthropic()
  const stream = client.beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        const final = await stream.finalMessage()
        if (final.stop_reason === 'refusal') {
          controller.enqueue(encoder.encode('\n\nNo puedo ayudarte con eso. Si tienes dudas sobre el panel, escríbenos a hola@lyte-app.com.'))
        } else if (final.stop_reason === 'max_tokens') {
          controller.enqueue(encoder.encode('…'))
        }
      } catch (err) {
        controller.enqueue(encoder.encode(err instanceof Anthropic.RateLimitError
          ? 'El asistente está muy solicitado ahora mismo. Intenta de nuevo en un minuto.'
          : 'Hubo un problema con el asistente. Intenta de nuevo.'))
      } finally {
        controller.close()
      }
    },
    cancel() { stream.abort() },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
