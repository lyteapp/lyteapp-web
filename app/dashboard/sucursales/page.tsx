'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useDashboardStore } from '../../lib/DashboardStoreProvider'

export default function SucursalesPage() {
  const router = useRouter()
  const { storeId, store, stores, setActiveStoreId, refreshStores } = useDashboardStore()
  const [unlinking, setUnlinking] = useState(false)

  if (!store) return null

  const parent = store.parent_store_id ? stores.find(s => s.id === store.parent_store_id) : null
  const branches = stores.filter(s => s.parent_store_id === storeId)

  async function unlink() {
    if (!storeId) return
    if (!confirm(`¿Convertir "${store!.name}" en una tienda independiente? Ya no aparecerá agrupada bajo su tienda principal.`)) return
    setUnlinking(true)
    await supabase.from('stores').update({ parent_store_id: null }).eq('id', storeId)
    await refreshStores()
    setUnlinking(false)
  }

  if (parent) {
    return (
      <div style={{ maxWidth: 560 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Sucursales</div>
        <div style={{
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 14,
          padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 14, color: '#334155' }}>
            <strong>{store.name}</strong> es una sucursal de <strong>{parent.name}</strong>.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setActiveStoreId(parent.id); router.push('/dashboard/sucursales') }}
              style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', color: '#0F172A', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Ir a {parent.name}
            </button>
            <button
              onClick={unlink}
              disabled={unlinking}
              style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {unlinking ? 'Desvinculando...' : 'Desvincular'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0F172A' }}>Sucursales</div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
            Tiendas agrupadas bajo {store.name} — cada una con su propio catálogo, diseño y URL.
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard/tienda/nueva')}
          style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#7C3AED', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          + Agregar sucursal
        </button>
      </div>

      {branches.length === 0 ? (
        <div style={{ background: '#F8FAFC', border: '1px dashed #E2E8F0', borderRadius: 14, padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          Esta tienda todavía no tiene sucursales.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {branches.map(b => (
            <div
              key={b.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                background: 'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600,
              }}>
                {b.logo_url
                  ? <img src={b.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : b.name.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{b.name}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--font-geist-mono), monospace' }}>lyte-app.com/{b.slug}</div>
              </div>
              <button
                onClick={() => { setActiveStoreId(b.id); router.push('/dashboard') }}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#0F172A', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
              >
                Entrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
