'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useDashboardStore } from '../../../lib/DashboardStoreProvider'
import UnsavedNotice, { stableJson } from '../UnsavedNotice'
import { shrinkImage } from '../../../lib/shrinkImage'
import '../canal.css'

// Kiosk mode: tablets see the store as a full-screen ordering layout (big
// product tiles, every category as a big picture button along the bottom),
// after the welcome page. Saved in template_config.kiosk; the preview is the
// real store (?kiosko=1), fed the unsaved settings by postMessage.

type KioskConfig = { enabled: boolean; categoryImages: Record<string, string> }
type Category = { id: string; name: string }

const DEFAULTS: KioskConfig = { enabled: false, categoryImages: {} }

// iPad Air, the most common kiosk tablet
const DEVICES = {
  portrait:  { w: 820,  h: 1180, label: 'Tablet vertical' },
  landscape: { w: 1180, h: 820,  label: 'Tablet horizontal' },
} as const
type Orientation = keyof typeof DEVICES

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="cn-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="cn-toggle-track" />
    </label>
  )
}

export default function KioskPage() {
  const { storeId } = useDashboardStore()
  const [slug, setSlug] = useState('')
  const [baseConfig, setBaseConfig] = useState<Record<string, unknown>>({})
  const [config, setConfig] = useState<KioskConfig>(DEFAULTS)
  const [savedConfig, setSavedConfig] = useState<KioskConfig | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [productPhoto, setProductPhoto] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState('')
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [orientation, setOrientation] = useState<Orientation>('portrait')
  const [reloadKey, setReloadKey] = useState(0)
  const hasUnsaved = !!savedConfig && stableJson(config) !== stableJson(savedConfig)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pickingFor = useRef<string | null>(null)

  // Preview size: the tablet scaled down to fit the column (and the screen)
  const colRef = useRef<HTMLDivElement>(null)
  const [colW, setColW] = useState(0)
  const [vh, setVh] = useState(800)
  useEffect(() => {
    const el = colRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setColW(el.clientWidth))
    ro.observe(el)
    const onResize = () => setVh(window.innerHeight)
    onResize()
    window.addEventListener('resize', onResize)
    return () => { ro.disconnect(); window.removeEventListener('resize', onResize) }
  }, [])
  const dev = DEVICES[orientation]
  const fit = colW > 0 ? Math.min(1, (colW - 24) / (dev.w + 24), Math.max(320, vh - 230) / (dev.h + 24)) : 0.4

  useEffect(() => {
    if (!storeId) return
    supabase.from('stores').select('slug, template_config').eq('id', storeId).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setSlug(data.slug ?? '')
        const cfg = (data.template_config ?? {}) as Record<string, unknown>
        setBaseConfig(cfg)
        const k = (cfg.kiosk ?? {}) as Partial<KioskConfig>
        const loaded = { enabled: !!k.enabled, categoryImages: { ...(k.categoryImages ?? {}) } }
        setConfig(loaded)
        setSavedConfig(loaded)
        const hidden = new Set((cfg.hiddenCategoryIds as string[] | undefined) ?? [])
        supabase.from('categories').select('id, name').eq('store_id', storeId).order('position', { ascending: true })
          .then(({ data: cats }) => setCategories((cats ?? []).filter(c => !hidden.has(c.id))))
      })
    supabase.from('products').select('category_id, image_url').eq('store_id', storeId)
      .then(({ data }) => {
        const first: Record<string, string> = {}
        for (const p of data ?? []) {
          const url = p.image_url as string | null
          if (p.category_id && url && !/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) && !first[p.category_id]) first[p.category_id] = url
        }
        setProductPhoto(first)
      })
  }, [storeId])

  // The preview always shows the kiosk (even before it's turned on), with
  // the settings as they are right now
  const sendDraft = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'lyte-kiosk-draft', kiosk: { ...config, enabled: true } }, window.location.origin)
  }, [config])
  useEffect(() => { sendDraft() }, [sendDraft])
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === 'lyte-kiosk-ready') sendDraft()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [sendDraft])

  async function save() {
    if (!storeId) return
    setError(''); setSaving(true)
    const template_config = { ...baseConfig, kiosk: config }
    const { error: err } = await supabase.from('stores').update({ template_config }).eq('id', storeId)
    if (err) setError(err.message)
    else {
      setBaseConfig(template_config)
      setSavedConfig(config)
      setJustSaved(true); setTimeout(() => setJustSaved(false), 2000)
    }
    setSaving(false)
  }

  function pickImage(catId: string) {
    pickingFor.current = catId
    fileRef.current?.click()
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const catId = pickingFor.current
    e.target.value = ''
    if (!file || !catId || !storeId) return
    setError(''); setUploadingId(catId)
    try {
      const small = await shrinkImage(file)
      const ext = (small.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `kiosk/${storeId}-${catId.slice(0, 8)}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('store-assets')
        .upload(path, small, { upsert: true, contentType: small.type || 'image/jpeg', cacheControl: '31536000' })
      if (upErr) throw upErr
      const url = supabase.storage.from('store-assets').getPublicUrl(path).data.publicUrl
      setConfig(c => ({ ...c, categoryImages: { ...c.categoryImages, [catId]: url } }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen')
    }
    setUploadingId(null)
  }
  function removeImage(catId: string) {
    setConfig(c => {
      const next = { ...c.categoryImages }
      delete next[catId]
      return { ...c, categoryImages: next }
    })
  }

  const kioskLink = slug ? `lyte-app.com/${slug}?kiosko=1` : ''

  return (
    <div className="cn-page" style={{ maxWidth: 'none' }}>
      <div className="cn-header">
        <div className="cn-title">Modo kiosko</div>
        <div className="cn-desc">Un diseño de pantalla completa para tablets: las categorías en grande abajo y los productos en tarjetas grandes. Tu página de inicio sigue saliendo primero.</div>
      </div>

      <div className="cn-kiosk-split">
        <div className="cn-kiosk-preview-col" ref={colRef} data-tour="kiosk-preview">
          <div className="cn-kiosk-devices" role="group" aria-label="Orientación de la tablet">
            {(Object.keys(DEVICES) as Orientation[]).map(o => (
              <button key={o} type="button" className={`cn-pill-btn${orientation === o ? ' selected' : ''}`} onClick={() => setOrientation(o)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                  {o === 'portrait' ? <rect x="5" y="2" width="14" height="20" rx="2" /> : <rect x="2" y="5" width="20" height="14" rx="2" />}
                </svg>
                {DEVICES[o].label}
              </button>
            ))}
          </div>
          <div className="cn-kiosk-stage" style={{ width: (dev.w + 24) * fit, height: (dev.h + 24) * fit }}>
            <div className="cn-kiosk-tablet" style={{ width: dev.w + 24, height: dev.h + 24, transform: `scale(${fit})` }}>
              {slug && (
                <iframe
                  key={reloadKey}
                  ref={iframeRef}
                  src={`/${slug}?preview=1&kiosko=1&_r=${reloadKey}`}
                  title="Vista previa del modo kiosko"
                  style={{ width: dev.w, height: dev.h }}
                  onLoad={sendDraft}
                />
              )}
            </div>
          </div>
          <button type="button" className="cn-kiosk-reload" onClick={() => setReloadKey(k => k + 1)}>Recargar vista previa</button>
        </div>

        <div className="cn-kiosk-panel">
          <div className="cn-section" data-tour="kiosk-toggle">
            <div className="cn-section-body">
              <div className="cn-toggle-row">
                <div className="cn-toggle-info">
                  <div className="cn-toggle-label">Activar modo kiosko</div>
                  <div className="cn-toggle-hint">Las tablets verán tu tienda con este diseño. En teléfonos y computadoras se sigue viendo igual que siempre.</div>
                </div>
                <Toggle checked={config.enabled} onChange={v => setConfig(c => ({ ...c, enabled: v }))} />
              </div>
              {kioskLink && (
                <div style={{ marginTop: 16 }}>
                  <div className="cn-label">Enlace para cualquier pantalla táctil</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="cn-kiosk-link">{kioskLink}</div>
                    <button type="button" className="cn-pill-btn" onClick={() => {
                      navigator.clipboard.writeText(`https://${kioskLink}`).catch(() => {})
                      setCopied(true); setTimeout(() => setCopied(false), 1500)
                    }}>{copied ? 'Copiado' : 'Copiar'}</button>
                  </div>
                  <div className="cn-toggle-hint" style={{ marginTop: 6 }}>Ábrelo en tu kiosko si no es una tablet, por ejemplo una pantalla táctil grande. Funciona con el modo kiosko activado.</div>
                </div>
              )}
            </div>
          </div>

          <div className="cn-section" data-tour="kiosk-cats">
            <div className="cn-section-head">
              <div>
                <div className="cn-section-title">Imágenes de las categorías</div>
                <div className="cn-section-sub">Salen en los botones grandes de abajo. Si no subes una, usamos la foto de un producto de esa categoría.</div>
              </div>
            </div>
            <div className="cn-section-body">
              {categories.length === 0 ? (
                <div className="cn-toggle-hint">Aún no tienes categorías. Créalas en Productos → Categorías.</div>
              ) : (
                <div className="cn-kiosk-cats">
                  {categories.map(cat => {
                    const own = config.categoryImages[cat.id]
                    const shown = own || productPhoto[cat.id]
                    return (
                      <div key={cat.id} className="cn-kiosk-cat">
                        <div className="cn-kiosk-cat-thumb">
                          {shown
                            ? <img src={shown} alt="" style={own ? undefined : { opacity: 0.55 }} />
                            : <span>{cat.name.trim().charAt(0).toUpperCase()}</span>}
                        </div>
                        <div className="cn-kiosk-cat-info">
                          <div className="cn-kiosk-cat-name">{cat.name}</div>
                          <div className="cn-toggle-hint">{own ? 'Imagen propia' : shown ? 'Foto de un producto' : 'Sin imagen'}</div>
                        </div>
                        <button type="button" className="cn-pill-btn" disabled={uploadingId === cat.id} onClick={() => pickImage(cat.id)}>
                          {uploadingId === cat.id ? 'Subiendo…' : own ? 'Cambiar' : 'Subir'}
                        </button>
                        {own && (
                          <button type="button" className="cn-kiosk-remove" onClick={() => removeImage(cat.id)} aria-label={`Quitar la imagen de ${cat.name}`}>
                            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fillRule="evenodd" d="M4.3 4.3a1 1 0 011.4 0L10 8.6l4.3-4.3a1 1 0 111.4 1.4L11.4 10l4.3 4.3a1 1 0 01-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 01-1.4-1.4L8.6 10 4.3 5.7a1 1 0 010-1.4z" clipRule="evenodd" /></svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            </div>
          </div>

          {error && <div className="cn-kiosk-error">{error}</div>}
          <button type="button" className="cn-save-btn" disabled={saving || !hasUnsaved} style={{ width: '100%' }} onClick={save}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <UnsavedNotice className="cn-kiosk-unsaved" dirty={hasUnsaved} justSaved={justSaved} saving={saving}
        onSave={save} onDiscard={() => { if (savedConfig) setConfig(savedConfig); setError('') }} />
    </div>
  )
}
