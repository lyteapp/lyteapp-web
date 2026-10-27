'use client'

// "Tienes cambios sin guardar · Cancelar · Guardar" — the same notice as the
// Vitrina editor's, shared by the Canal editors (checkout, pagina de inicio,
// rastreo). Styles live in canal.css (.cn-unsaved*).

// Key-sorted JSON, so two settings objects compare by value
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter(k => (v as Record<string, unknown>)[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

export default function UnsavedNotice({ dirty, justSaved, saving, onSave, onDiscard, className = '' }: {
  dirty: boolean
  /** Shows "✓ Cambios guardados" for a moment after saving */
  justSaved: boolean
  saving: boolean
  onSave: () => void
  onDiscard: () => void
  className?: string
}) {
  if (!dirty && !justSaved) return null
  return (
    <div className={`cn-unsaved${dirty ? '' : ' cn-unsaved-done'} ${className}`} role="status">
      {dirty ? (
        <>
          <span className="cn-unsaved-dot" />
          <span className="cn-unsaved-text">Tienes cambios sin guardar</span>
          <button type="button" className="cn-unsaved-btn cn-unsaved-cancel" onClick={onDiscard} disabled={saving}>Cancelar</button>
          <button type="button" className="cn-unsaved-btn" onClick={onSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      ) : (
        <span className="cn-unsaved-text">✓ Cambios guardados</span>
      )}
    </div>
  )
}
