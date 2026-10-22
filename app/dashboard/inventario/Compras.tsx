'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { METODOS_BASE, normalizarLibro, type Metodo } from '../../finanzas/flujo/model'
import ItemPicker from './ItemPicker'

// Inventory purchases: lines go into a warehouse at cost (inv_register_purchase),
// paid from a Finanzas account (an outflow there) or on credit (a debt with
// the supplier, paid later with inv_pay_purchase). The invoice photo goes to
// the private 'invoices' bucket.

type Item = { id: string; name: string; unit: string; purchase_unit: string | null; purchase_factor: number; avg_cost: number; active: boolean; supplier_id: string | null; sku?: string | null; barcode?: string | null; category?: string | null }
type Supplier = { id: string; name: string; active: boolean }
type Warehouse = { id: string; name: string; is_default: boolean; active: boolean }
type Purchase = {
  id: string; supplier_id: string | null; warehouse_id: string; date: string; invoice_number: string | null
  invoice_path: string | null; total_usd: number; paid_usd: number; status: 'paid' | 'credit' | 'partial'
  due_date: string | null; notes: string | null; created_at: string
}
type PurchaseLine = { id: string; item_id: string; qty: number; unit_kind: 'base' | 'purchase'; base_qty: number; unit_cost: number; total: number; warehouse_id: string | null }
type Payment = { id: string; date: string; method_id: string; amount: number; amount_usd: number; rate: number | null }

// whId '' = goes to the invoice's warehouse
type Line = { itemId: string; qty: string; unitKind: 'base' | 'purchase'; cost: string; whId: string }

const parseNum = (s: string) => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : NaN }
const money = (n: number) => `$${n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const bs = (n: number) => `Bs ${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
const fmtDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
const STATUS: Record<Purchase['status'], { label: string; cls: string }> = {
  paid: { label: 'Pagada', cls: 'ok' }, credit: { label: 'Por pagar', cls: 'warn' }, partial: { label: 'Pago parcial', cls: 'warn' },
}

export default function Compras({ storeId, items, suppliers, warehouses, onChanged, flash }: {
  storeId: string
  items: Item[]
  suppliers: Supplier[]
  warehouses: Warehouse[]
  onChanged: () => void
  flash: (m: string) => void
}) {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [accounts, setAccounts] = useState<Metodo[]>(METODOS_BASE)
  const [bcv, setBcv] = useState<number>(0)
  const [filter, setFilter] = useState<'all' | 'due'>('all')

  const load = useCallback(async () => {
    const [{ data: p }, { data: book }] = await Promise.all([
      supabase.from('inv_purchases').select('*').eq('store_id', storeId).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
      supabase.from('fin_books').select('data').eq('store_id', storeId).eq('key', 'flujo').maybeSingle(),
    ])
    setPurchases(((p ?? []) as Purchase[]).map(x => ({ ...x, total_usd: Number(x.total_usd) || 0, paid_usd: Number(x.paid_usd) || 0 })))
    if (book?.data) setAccounts(normalizarLibro(book.data).metodos)
  }, [storeId])
  useEffect(() => { Promise.resolve().then(load) }, [load])
  useEffect(() => {
    fetch(`/api/bcv-rate?store=${storeId}`).then(r => r.json()).then(d => { const r = d.rate ?? d.rates?.USD; if (r > 0) setBcv(r) }).catch(() => {})
  }, [storeId])

  // Suppliers created from the purchase form, shown right away (the parent's
  // list catches up on its next reload)
  const [newSuppliers, setNewSuppliers] = useState<Supplier[]>([])
  const allSuppliers = [...suppliers, ...newSuppliers.filter(n => !suppliers.some(s => s.id === n.id))]
  const supplierName = (id: string | null) => allSuppliers.find(s => s.id === id)?.name ?? 'Sin proveedor'
  const [supDraft, setSupDraft] = useState<null | { name: string; taxId: string; phone: string }>(null)
  const [supSaving, setSupSaving] = useState(false)
  async function createSupplier() {
    if (!supDraft?.name.trim()) return
    setSupSaving(true)
    const { data, error } = await supabase.from('inv_suppliers').insert({
      store_id: storeId, name: supDraft.name.trim(),
      tax_id: supDraft.taxId.trim() || null, phone: supDraft.phone.trim() || null,
    }).select('id, name, active').single()
    setSupSaving(false)
    if (error || !data) return flash(error?.message ?? 'No se pudo crear el proveedor')
    setNewSuppliers(prev => [...prev, data as Supplier])
    setForm(f => f ? { ...f, supplierId: data.id } : f)
    setSupDraft(null)
    flash('Proveedor creado')
    onChanged()
  }
  const accountOf = (id: string) => accounts.find(a => a.id === id)
  const activeItems = items.filter(i => i.active)
  const activeWh = warehouses.filter(w => w.active)
  const defaultWh = activeWh.find(w => w.is_default)?.id ?? activeWh[0]?.id ?? ''

  const debt = purchases.reduce((t, p) => t + Math.max(0, p.total_usd - p.paid_usd), 0)
  const month = todayISO().slice(0, 7)
  const monthTotal = purchases.filter(p => p.date.startsWith(month)).reduce((t, p) => t + p.total_usd, 0)
  const shown = filter === 'due' ? purchases.filter(p => p.status !== 'paid') : purchases

  // ── new purchase ──
  const blankLine = (): Line => ({ itemId: '', qty: '', unitKind: 'base', cost: '', whId: '' })
  const [form, setForm] = useState<null | {
    supplierId: string; whId: string; date: string; invoice: string; notes: string
    currency: 'USD' | 'VES'; rate: string; lines: Line[]
    pay: 'now' | 'credit'; accountId: string; dueDate: string
    photo: File | null; photoPreview: string
  }>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  function openNew() {
    setFormError('')
    setSupDraft(null)
    setForm({
      supplierId: '', whId: defaultWh, date: todayISO(), invoice: '', notes: '',
      currency: 'USD', rate: bcv ? String(bcv) : '', lines: [blankLine()],
      pay: 'now', accountId: accounts[0]?.id ?? '', dueDate: '', photo: null, photoPreview: '',
    })
  }

  const rateNum = form ? parseNum(form.rate) : NaN
  const toUSD = (amount: number) => form?.currency === 'VES' ? (rateNum > 0 ? amount / rateNum : NaN) : amount
  const lineTotal = (l: Line) => { const q = parseNum(l.qty), c = parseNum(l.cost); return Number.isFinite(q) && Number.isFinite(c) ? q * c : 0 }
  const invoiceTotal = form ? form.lines.reduce((t, l) => t + lineTotal(l), 0) : 0
  const totalUSD = toUSD(invoiceTotal)
  const payAccount = form ? accountOf(form.accountId) : undefined
  const payInBs = payAccount?.moneda === 'VES'

  async function savePurchase() {
    if (!form) return
    const lines = form.lines.filter(l => l.itemId)
    if (!form.whId) return setFormError('Elige el almacén donde entra la mercancía.')
    if (lines.length === 0) return setFormError('Agrega al menos un artículo.')
    for (const l of lines) {
      if (!(parseNum(l.qty) > 0) || !(parseNum(l.cost) >= 0)) return setFormError(`Revisa cantidad y costo de ${items.find(i => i.id === l.itemId)?.name}.`)
    }
    if (form.currency === 'VES' && !(rateNum > 0)) return setFormError('Pon la tasa de cambio de la factura.')
    if (form.pay === 'now' && !form.accountId) return setFormError('Elige la cuenta con la que pagaste.')
    if (form.pay === 'now' && payInBs && !(rateNum > 0) && !(bcv > 0)) return setFormError('Pon la tasa para pagar en bolívares.')
    setSaving(true); setFormError('')

    let invoicePath: string | null = null
    if (form.photo) {
      const ext = (form.photo.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${storeId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('invoices').upload(path, form.photo, { contentType: form.photo.type })
      if (error) { setSaving(false); return setFormError('No se pudo subir la foto de la factura: ' + error.message) }
      invoicePath = path
    }

    const payRate = form.currency === 'VES' ? rateNum : bcv
    const payment = form.pay === 'now' && totalUSD > 0 ? {
      method_id: form.accountId,
      // A Bs account pays the invoice's Bs total (or its USD total at the rate)
      amount: payInBs ? (form.currency === 'VES' ? invoiceTotal : totalUSD * payRate) : totalUSD,
      amount_usd: Math.round(totalUSD * 100) / 100,
      rate: payInBs ? payRate : null,
    } : undefined

    const { error } = await supabase.rpc('inv_register_purchase', {
      p: {
        store_id: storeId, supplier_id: form.supplierId || null, warehouse_id: form.whId, date: form.date,
        invoice_number: form.invoice.trim() || null, invoice_path: invoicePath, notes: form.notes.trim() || null,
        due_date: form.pay === 'credit' && form.dueDate ? form.dueDate : null,
        lines: lines.map(l => ({ item_id: l.itemId, qty: parseNum(l.qty), unit_kind: l.unitKind, unit_cost: Math.round(toUSD(parseNum(l.cost)) * 1e6) / 1e6, warehouse_id: l.whId || null })),
        payment,
      },
    })
    setSaving(false)
    if (error) return setFormError(error.message)
    setForm(null)
    flash(form.pay === 'now' ? 'Compra registrada y pagada' : 'Compra registrada a crédito')
    load(); onChanged()
  }

  // ── detail / pay ──
  const [detail, setDetail] = useState<null | { p: Purchase; lines: PurchaseLine[]; payments: Payment[]; photoUrl: string | null }>(null)
  const [payForm, setPayForm] = useState<null | { accountId: string; usd: string; rate: string; date: string }>(null)
  const [paying, setPaying] = useState(false)
  async function openDetail(p: Purchase) {
    const [{ data: lines }, { data: pays }, signed] = await Promise.all([
      supabase.from('inv_purchase_items').select('id, item_id, qty, unit_kind, base_qty, unit_cost, total, warehouse_id').eq('purchase_id', p.id),
      supabase.from('inv_purchase_payments').select('id, date, method_id, amount, amount_usd, rate').eq('purchase_id', p.id).order('date'),
      p.invoice_path ? supabase.storage.from('invoices').createSignedUrl(p.invoice_path, 3600) : Promise.resolve({ data: null }),
    ])
    setPayForm(null)
    setDetail({
      p,
      lines: ((lines ?? []) as PurchaseLine[]).map(l => ({ ...l, qty: Number(l.qty), unit_cost: Number(l.unit_cost), total: Number(l.total) })),
      payments: ((pays ?? []) as Payment[]).map(x => ({ ...x, amount: Number(x.amount), amount_usd: Number(x.amount_usd) })),
      photoUrl: (signed as { data: { signedUrl: string } | null }).data?.signedUrl ?? null,
    })
  }
  async function payPurchase() {
    if (!detail || !payForm) return
    const usd = parseNum(payForm.usd)
    const acc = accountOf(payForm.accountId)
    const rate = parseNum(payForm.rate)
    if (!(usd > 0) || !acc) return flash('Revisa cuenta y monto')
    if (acc.moneda === 'VES' && !(rate > 0)) return flash('Pon la tasa del pago')
    setPaying(true)
    const { error } = await supabase.rpc('inv_pay_purchase', {
      p_purchase: detail.p.id, p_date: payForm.date, p_method: acc.id,
      p_amount: acc.moneda === 'VES' ? Math.round(usd * rate * 100) / 100 : usd, p_amount_usd: usd,
      p_rate: acc.moneda === 'VES' ? rate : null,
    })
    setPaying(false)
    if (error) return flash(error.message)
    flash('Pago registrado')
    await load()
    const { data: fresh } = await supabase.from('inv_purchases').select('*').eq('id', detail.p.id).single()
    if (fresh) openDetail({ ...(fresh as Purchase), total_usd: Number(fresh.total_usd), paid_usd: Number(fresh.paid_usd) })
  }

  const itemName = useMemo(() => new Map(items.map(i => [i.id, i])), [items])

  return (
    <>
      <div className="inv-cards">
        <div className="inv-card featured"><span>Comprado este mes</span><strong>{money(monthTotal)}</strong></div>
        <button className={`inv-card${filter === 'due' ? ' on' : ''}`} onClick={() => setFilter(f => f === 'due' ? 'all' : 'due')}>
          <span>Por pagar a proveedores</span><strong className={debt > 0 ? 'warn' : ''}>{money(debt)}</strong>
        </button>
        <div className="inv-card"><span>Compras registradas</span><strong>{purchases.length}</strong></div>
        <div className="inv-card"><span>Tasa BCV</span><strong>{bcv ? bcv.toLocaleString('es-VE', { maximumFractionDigits: 2 }) : '—'}</strong></div>
      </div>

      <div className="inv-toolbar">
        <div className="inv-toolbar-title">{filter === 'due' ? 'Compras con saldo pendiente' : 'Últimas compras'}</div>
        <button className="inv-btn primary" onClick={openNew} disabled={activeItems.length === 0 || activeWh.length === 0}>+ Nueva compra</button>
      </div>

      {activeItems.length === 0 ? (
        <div className="inv-empty"><span>Primero crea los artículos que compras (pestaña Artículos).</span></div>
      ) : shown.length === 0 ? (
        <div className="inv-empty"><span>{filter === 'due' ? 'No le debes nada a ningún proveedor.' : 'Todavía no hay compras registradas.'}</span></div>
      ) : (
        <div className="inv-list">
          {shown.map(p => {
            const pending = Math.max(0, p.total_usd - p.paid_usd)
            return (
              <button key={p.id} className="inv-row inv-row-btn" onClick={() => openDetail(p)}>
                <div className="inv-row-main">
                  <div className="inv-row-name">
                    {supplierName(p.supplier_id)}
                    <span className={`inv-tag ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
                    {p.invoice_path && <span className="inv-tag" title="Tiene foto de factura">📎 Factura</span>}
                  </div>
                  <div className="inv-row-meta">
                    <span className="inv-muted">{fmtDay(p.date)}</span>
                    {p.invoice_number && <span className="inv-muted">N° {p.invoice_number}</span>}
                    <span className="inv-muted">{warehouses.find(w => w.id === p.warehouse_id)?.name}</span>
                    {pending > 0 && p.due_date && <span className="inv-tag warn">Vence {fmtDay(p.due_date)}</span>}
                  </div>
                </div>
                <div className="inv-row-qty">
                  <strong>{money(p.total_usd)}</strong>
                  {pending > 0 && <div className="inv-muted warn-text">debe {money(pending)}</div>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ══ NUEVA COMPRA ══ */}
      {form && (
        <div className="inv-overlay" onClick={() => setForm(null)}>
          <div className="inv-modal inv-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="inv-modal-head">
              <strong>Nueva compra</strong>
              <button className="inv-x" onClick={() => setForm(null)} aria-label="Cerrar">✕</button>
            </div>

            <div className="inv-two">
              <label className="inv-field"><span>Proveedor</span>
                <select className="inv-input" value={form.supplierId} onChange={e => {
                  if (e.target.value === '__new') { setSupDraft({ name: '', taxId: '', phone: '' }); return }
                  setForm({ ...form, supplierId: e.target.value })
                }}>
                  <option value="">— Sin proveedor —</option>
                  {allSuppliers.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="__new">+ Nuevo proveedor…</option>
                </select>
              </label>
              <label className="inv-field"><span>{activeWh.length > 1 ? 'Almacén de toda la factura' : 'Entra al almacén'}</span>
                <select className="inv-input" value={form.whId} onChange={e => setForm({ ...form, whId: e.target.value })}>
                  {activeWh.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
            </div>
            {supDraft && (
              <div className="inv-subform">
                <div className="inv-subform-title">Nuevo proveedor</div>
                <input className="inv-input" placeholder="Nombre o razón social *" value={supDraft.name} onChange={e => setSupDraft({ ...supDraft, name: e.target.value })} autoFocus />
                <div className="inv-two">
                  <input className="inv-input" placeholder="RIF" value={supDraft.taxId} onChange={e => setSupDraft({ ...supDraft, taxId: e.target.value })} />
                  <input className="inv-input" placeholder="Teléfono / WhatsApp" inputMode="tel" value={supDraft.phone} onChange={e => setSupDraft({ ...supDraft, phone: e.target.value })} />
                </div>
                <div className="inv-modal-actions">
                  <button className="inv-btn ghost small" onClick={() => setSupDraft(null)}>Cancelar</button>
                  <button className="inv-btn primary small" onClick={createSupplier} disabled={supSaving || !supDraft.name.trim()}>{supSaving ? 'Guardando…' : 'Crear y usar'}</button>
                </div>
              </div>
            )}

            <div className="inv-two">
              <label className="inv-field"><span>Fecha</span>
                <input className="inv-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </label>
              <label className="inv-field"><span>N° de factura</span>
                <input className="inv-input" value={form.invoice} onChange={e => setForm({ ...form, invoice: e.target.value })} placeholder="Opcional" />
              </label>
            </div>

            <label className="inv-photo">
              <input type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={e => {
                const f = e.target.files?.[0] ?? null
                setForm({ ...form, photo: f, photoPreview: f && f.type.startsWith('image/') ? URL.createObjectURL(f) : '' })
              }} />
              {form.photoPreview
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={form.photoPreview} alt="Factura" />
                : <span className="inv-photo-icon">📷</span>}
              <span>{form.photo ? form.photo.name : 'Foto de la factura'}<small>{form.photo ? 'Toca para cambiarla' : 'Toma una foto o elige una imagen o PDF'}</small></span>
            </label>

            <div className="inv-seg inv-seg-2">
              <button className={form.currency === 'USD' ? 'on' : ''} onClick={() => setForm({ ...form, currency: 'USD' })}>Factura en $</button>
              <button className={form.currency === 'VES' ? 'on' : ''} onClick={() => setForm({ ...form, currency: 'VES', rate: form.rate || (bcv ? String(bcv) : '') })}>Factura en Bs</button>
            </div>
            {form.currency === 'VES' && (
              <label className="inv-field"><span>Tasa (Bs por $)</span>
                <input className="inv-input" inputMode="decimal" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value.replace(/[^0-9.,]/g, '') })} />
              </label>
            )}

            <div className="inv-lines">
              <div className="inv-lines-head"><span>Artículo</span><span>Cantidad</span><span>Costo unit. ({form.currency === 'VES' ? 'Bs' : '$'})</span><span /></div>
              {form.lines.map((l, i) => {
                const it = itemName.get(l.itemId)
                const set = (patch: Partial<Line>) => setForm({ ...form, lines: form.lines.map((x, j) => j === i ? { ...x, ...patch } : x) })
                return (
                  <div key={i} className="inv-line">
                    <ItemPicker
                      items={activeItems}
                      value={l.itemId}
                      onPick={n => {
                        const usesPurchase = !!n.purchase_unit
                        const costUSD = n.avg_cost * (usesPurchase ? n.purchase_factor : 1)
                        set({ itemId: n.id, unitKind: usesPurchase ? 'purchase' : 'base',
                          cost: costUSD ? String(Math.round((form.currency === 'VES' && rateNum > 0 ? costUSD * rateNum : costUSD) * 100) / 100) : '' })
                      }}
                    />
                    <div className="inv-line-qty">
                      <input className="inv-input" inputMode="decimal" placeholder="0" value={l.qty} onChange={e => set({ qty: e.target.value.replace(/[^0-9.,]/g, '') })} />
                      {it?.purchase_unit ? (
                        <select className="inv-input" value={l.unitKind} onChange={e => set({ unitKind: e.target.value as Line['unitKind'] })}>
                          <option value="purchase">{it.purchase_unit} ({it.purchase_factor} {it.unit})</option>
                          <option value="base">{it.unit}</option>
                        </select>
                      ) : <span className="inv-muted">{it?.unit ?? ''}</span>}
                    </div>
                    <input className="inv-input" inputMode="decimal" placeholder="0,00" value={l.cost} onChange={e => set({ cost: e.target.value.replace(/[^0-9.,]/g, '') })} />
                    <button className="inv-x" onClick={() => setForm({ ...form, lines: form.lines.length > 1 ? form.lines.filter((_, j) => j !== i) : [blankLine()] })} aria-label="Quitar">✕</button>
                    {activeWh.length > 1 && (
                      <select className="inv-input inv-line-wh" value={l.whId} onChange={e => set({ whId: e.target.value })}>
                        <option value="">→ {activeWh.find(w => w.id === form.whId)?.name ?? 'Almacén de la factura'} (el de la factura)</option>
                        {activeWh.filter(w => w.id !== form.whId).map(w => <option key={w.id} value={w.id}>→ {w.name}</option>)}
                      </select>
                    )}
                    {lineTotal(l) > 0 && <div className="inv-line-total">= {form.currency === 'VES' ? bs(lineTotal(l)) : money(lineTotal(l))}</div>}
                  </div>
                )
              })}
              <button className="inv-btn small" onClick={() => setForm({ ...form, lines: [...form.lines, blankLine()] })}>+ Agregar artículo</button>
            </div>

            <div className="inv-total">
              <span>Total</span>
              <strong>
                {form.currency === 'VES' ? bs(invoiceTotal) : money(invoiceTotal)}
                {form.currency === 'VES' && Number.isFinite(totalUSD) && <small> ≈ {money(totalUSD)}</small>}
              </strong>
            </div>

            <div className="inv-seg inv-seg-2">
              <button className={form.pay === 'now' ? 'on' : ''} onClick={() => setForm({ ...form, pay: 'now' })}>Pagada</button>
              <button className={form.pay === 'credit' ? 'on' : ''} onClick={() => setForm({ ...form, pay: 'credit' })}>A crédito</button>
            </div>
            {form.pay === 'now' ? (
              <>
                <label className="inv-field"><span>Pagaste con (cuenta de Finanzas)</span>
                  <select className="inv-input" value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })}>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.nombre} · {a.moneda === 'VES' ? 'Bs' : a.moneda}</option>)}
                  </select>
                </label>
                {payInBs && form.currency === 'USD' && Number.isFinite(totalUSD) && (
                  <div className="inv-hint">Se descuentan <strong>{bs(totalUSD * (bcv || 0))}</strong> de {payAccount?.nombre} (tasa {bcv || '—'}).</div>
                )}
              </>
            ) : (
              <label className="inv-field"><span>Vence el (opcional)</span>
                <input className="inv-input" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </label>
            )}

            <label className="inv-field"><span>Notas</span>
              <input className="inv-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </label>

            {formError && <div className="inv-error">{formError}</div>}
            <div className="inv-modal-actions">
              <button className="inv-btn ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button className="inv-btn primary" onClick={savePurchase} disabled={saving}>{saving ? 'Guardando…' : 'Registrar compra'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DETALLE ══ */}
      {detail && (() => {
        const { p } = detail
        const pending = Math.max(0, p.total_usd - p.paid_usd)
        const payAcc = payForm ? accountOf(payForm.accountId) : undefined
        return (
          <div className="inv-overlay" onClick={() => setDetail(null)}>
            <div className="inv-modal inv-modal-wide" onClick={e => e.stopPropagation()}>
              <div className="inv-modal-head">
                <strong>{supplierName(p.supplier_id)}</strong>
                <button className="inv-x" onClick={() => setDetail(null)} aria-label="Cerrar">✕</button>
              </div>
              <div className="inv-row-meta">
                <span className={`inv-tag ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
                <span className="inv-muted">{fmtDay(p.date)}</span>
                {p.invoice_number && <span className="inv-muted">Factura N° {p.invoice_number}</span>}
                <span className="inv-muted">→ {warehouses.find(w => w.id === p.warehouse_id)?.name}</span>
              </div>

              {detail.photoUrl && (
                <a href={detail.photoUrl} target="_blank" rel="noreferrer" className="inv-invoice-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.invoice_path?.endsWith('.pdf') ? <span>📄 Ver factura (PDF)</span> : <img src={detail.photoUrl} alt="Factura" />}
                </a>
              )}

              <div className="inv-list">
                {detail.lines.map(l => {
                  const it = itemName.get(l.item_id)
                  return (
                    <div key={l.id} className="inv-mini-row">
                      <span>{it?.name ?? '—'}{l.warehouse_id && l.warehouse_id !== p.warehouse_id && <small className="inv-muted"> → {warehouses.find(w => w.id === l.warehouse_id)?.name}</small>}</span>
                      <span className="inv-muted">{l.qty} {l.unit_kind === 'purchase' ? it?.purchase_unit : it?.unit} × {money(l.unit_cost)}</span>
                      <strong>{money(l.total)}</strong>
                    </div>
                  )
                })}
              </div>
              <div className="inv-total"><span>Total</span><strong>{money(p.total_usd)}</strong></div>

              {detail.payments.length > 0 && (
                <div className="inv-list">
                  {detail.payments.map(x => (
                    <div key={x.id} className="inv-mini-row">
                      <span>Pago · {accountOf(x.method_id)?.nombre ?? x.method_id}</span>
                      <span className="inv-muted">{fmtDay(x.date)}{x.rate ? ` · ${bs(x.amount)} a ${x.rate}` : ''}</span>
                      <strong className="pos">−{money(x.amount_usd)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {pending > 0 && <div className="inv-total warn"><span>Pendiente</span><strong>{money(pending)}</strong></div>}
              {p.notes && <div className="inv-hint">{p.notes}</div>}

              {pending > 0 && !payForm && (
                <button className="inv-btn primary" onClick={() => setPayForm({ accountId: accounts[0]?.id ?? '', usd: pending.toFixed(2), rate: bcv ? String(bcv) : '', date: todayISO() })}>
                  Registrar pago
                </button>
              )}
              {payForm && (
                <div className="inv-pay">
                  <div className="inv-two">
                    <label className="inv-field"><span>Cuenta</span>
                      <select className="inv-input" value={payForm.accountId} onChange={e => setPayForm({ ...payForm, accountId: e.target.value })}>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.nombre} · {a.moneda === 'VES' ? 'Bs' : a.moneda}</option>)}
                      </select>
                    </label>
                    <label className="inv-field"><span>Monto ($)</span>
                      <input className="inv-input" inputMode="decimal" value={payForm.usd} onChange={e => setPayForm({ ...payForm, usd: e.target.value.replace(/[^0-9.,]/g, '') })} />
                    </label>
                  </div>
                  <div className="inv-two">
                    <label className="inv-field"><span>Fecha</span>
                      <input className="inv-input" type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} />
                    </label>
                    {payAcc?.moneda === 'VES' && (
                      <label className="inv-field"><span>Tasa (Bs por $)</span>
                        <input className="inv-input" inputMode="decimal" value={payForm.rate} onChange={e => setPayForm({ ...payForm, rate: e.target.value.replace(/[^0-9.,]/g, '') })} />
                      </label>
                    )}
                  </div>
                  {payAcc?.moneda === 'VES' && parseNum(payForm.usd) > 0 && parseNum(payForm.rate) > 0 && (
                    <div className="inv-hint">Se descuentan <strong>{bs(parseNum(payForm.usd) * parseNum(payForm.rate))}</strong> de {payAcc.nombre}.</div>
                  )}
                  <div className="inv-modal-actions">
                    <button className="inv-btn ghost" onClick={() => setPayForm(null)}>Cancelar</button>
                    <button className="inv-btn primary" onClick={payPurchase} disabled={paying}>{paying ? 'Guardando…' : 'Confirmar pago'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </>
  )
}
