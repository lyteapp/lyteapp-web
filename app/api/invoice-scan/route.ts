import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Reads a photo (or PDF) of a supplier invoice with Claude and returns its
// data for Inventario → Nueva compra: supplier, number, date, currency and
// every line — each line matched to one of the store's items when possible.
// The merchant reviews and corrects everything before saving.

export const maxDuration = 60

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'supplier_name', 'supplier_tax_id', 'matched_supplier_id', 'invoice_number', 'date', 'currency', 'exchange_rate', 'lines', 'subtotal', 'tax', 'total'],
  properties: {
    readable: { type: 'boolean', description: 'false if the image is not an invoice/receipt or cannot be read' },
    supplier_name: { type: 'string', description: 'Issuer (seller) name as printed; "" if not visible' },
    supplier_tax_id: { type: 'string', description: 'Issuer RIF/NIT/RUC as printed; "" if not visible' },
    matched_supplier_id: { type: 'string', description: 'id from KNOWN SUPPLIERS that is this issuer, or ""' },
    invoice_number: { type: 'string', description: 'Invoice / control number; "" if not visible' },
    date: { type: 'string', description: 'Issue date as YYYY-MM-DD; "" if not visible' },
    currency: { type: 'string', enum: ['USD', 'VES'], description: 'Currency the amounts are written in (Bs/VES or $/USD)' },
    exchange_rate: { type: 'number', description: 'Bs per USD rate printed on the invoice, or 0' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'quantity', 'unit_price', 'line_total', 'matched_item_id', 'unit_kind'],
        properties: {
          description: { type: 'string', description: 'Product as printed on the invoice' },
          quantity: { type: 'number' },
          unit_price: { type: 'number', description: 'Price per unit before tax, in the invoice currency' },
          line_total: { type: 'number', description: 'Line amount before tax, in the invoice currency' },
          matched_item_id: { type: 'string', description: 'id from KNOWN ITEMS that is this product, or ""' },
          unit_kind: { type: 'string', enum: ['base', 'purchase'], description: '"purchase" when the quantity is counted in the matched item\'s purchase unit (e.g. boxes), else "base"' },
        },
      },
    },
    subtotal: { type: 'number', description: 'Amount before tax, or 0' },
    tax: { type: 'number', description: 'Total tax (IVA) charged, or 0' },
    total: { type: 'number', description: 'Grand total to pay, or 0' },
  },
} as const

const SYSTEM = `You read photos of supplier invoices and receipts for a small business inventory system (mostly Latin America — Venezuela: amounts in Bs or USD, tax is IVA, tax id is RIF).

Extract exactly what is printed; never invent values. Use "" or 0 when something isn't visible.
- One line per product row. Quantities and prices as plain numbers (convert "1.234,56" to 1234.56).
- unit_price and line_total are before tax. If the invoice only shows prices with tax included, use them as printed and set tax to 0.
- Match each line to KNOWN ITEMS by meaning, not exact spelling (brand/size variants of the same product match). Leave matched_item_id "" when unsure — a wrong match is worse than none.
- If the matched item has a purchase unit (e.g. "caja = 12 und") and the invoice counts that unit, use unit_kind "purchase"; otherwise "base".
- Match the issuer to KNOWN SUPPLIERS by name or tax id; "" when not listed.`

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'El escáner con IA todavía no está configurado.' }, { status: 503 })
  }
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null) as { storeId?: string; mediaType?: string; data?: string } | null
  const storeId = body?.storeId
  const mediaType = body?.mediaType ?? ''
  const data = body?.data ?? ''
  const isPdf = mediaType === 'application/pdf'
  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
  if (!storeId || !data || (!isPdf && !imageTypes.includes(mediaType as typeof imageTypes[number]))) {
    return Response.json({ error: 'Envía una foto (JPG/PNG) o un PDF de la factura.' }, { status: 400 })
  }
  if (data.length > 14_000_000) return Response.json({ error: 'El archivo es demasiado grande.' }, { status: 413 })

  // Queries run as the merchant (their token), so RLS limits them to their own store
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const { data: store } = await supabase.from('stores').select('id').eq('id', storeId).eq('owner_id', user.id).maybeSingle()
  if (!store) return Response.json({ error: 'No autorizado' }, { status: 403 })

  const [{ data: items }, { data: suppliers }] = await Promise.all([
    supabase.from('inv_items').select('id, name, unit, purchase_unit, purchase_factor, sku, category').eq('store_id', storeId).eq('active', true).limit(1500),
    supabase.from('inv_suppliers').select('id, name, tax_id').eq('store_id', storeId).eq('active', true).limit(500),
  ])
  const catalog = [
    'KNOWN ITEMS (id | name | unit | purchase unit):',
    ...(items ?? []).map(i => `${i.id} | ${i.name}${i.sku ? ` [${i.sku}]` : ''} | ${i.unit} | ${i.purchase_unit ? `${i.purchase_unit} = ${i.purchase_factor} ${i.unit}` : '-'}`),
    '',
    'KNOWN SUPPLIERS (id | name | tax id):',
    ...(suppliers ?? []).map(s => `${s.id} | ${s.name} | ${s.tax_id ?? '-'}`),
  ].join('\n')

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: jsonSchemaOutputFormat(SCHEMA) },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          isPdf
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
            : { type: 'image', source: { type: 'base64', media_type: mediaType as typeof imageTypes[number], data } },
          { type: 'text', text: `${catalog}\n\nExtract this invoice.` },
        ],
      }],
    })
    if (response.stop_reason === 'refusal') {
      return Response.json({ error: 'No se pudo leer esta imagen. Intenta con otra foto.' }, { status: 422 })
    }
    const out = response.parsed_output
    if (!out) return Response.json({ error: 'No se pudo leer la factura. Intenta con una foto más clara.' }, { status: 422 })
    if (!out.readable) return Response.json({ error: 'La imagen no parece una factura legible. Toma la foto de frente, con buena luz.' }, { status: 422 })

    // Only keep matches that are really this store's items / suppliers
    const itemIds = new Set((items ?? []).map(i => i.id))
    const supplierIds = new Set((suppliers ?? []).map(s => s.id))
    return Response.json({
      ...out,
      matched_supplier_id: supplierIds.has(out.matched_supplier_id) ? out.matched_supplier_id : '',
      lines: out.lines.map(l => ({ ...l, matched_item_id: itemIds.has(l.matched_item_id) ? l.matched_item_id : '' })),
    })
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: 'El escáner está muy solicitado. Intenta en un minuto.' }, { status: 429 })
    }
    if (err instanceof Anthropic.BadRequestError) {
      return Response.json({ error: 'No se pudo procesar ese archivo. Prueba con una foto JPG.' }, { status: 400 })
    }
    return Response.json({ error: 'Hubo un problema leyendo la factura. Intenta de nuevo.' }, { status: 502 })
  }
}
