'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { QRCodeSVG } from 'qrcode.react'
import '../store.css'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

function PedidoContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const storeSlug = params.store as string
  const waParam = searchParams.get('wa')
  const orderId = searchParams.get('id')
  const deliveryId = searchParams.get('delivery')
  const pickupId = searchParams.get('pickup')

  const [showWhatsappBtn, setShowWhatsappBtn] = useState(true)
  const [showTrackBtn, setShowTrackBtn] = useState(true)
  const [showMapBtn, setShowMapBtn] = useState(false)
  const [mapUrl, setMapUrl] = useState<string | null>(null)
  const [queueBoard, setQueueBoard] = useState<{ enabled: boolean } | null>(null)
  const [origin] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''))

  useEffect(() => {
    supabase
      .from('stores')
      .select('map_url, checkout_settings, template_config')
      .eq('slug', storeSlug)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const cs = (data.checkout_settings as Record<string, unknown>) ?? {}
        setShowWhatsappBtn(cs.showWhatsappBtn !== false)
        setShowTrackBtn(cs.showTrackBtn !== false)
        setShowMapBtn(Boolean(cs.showMapBtn))
        setMapUrl((data.map_url as string | null) ?? null)
        const tc = (data.template_config as Record<string, unknown>) ?? {}
        const tracking = (tc.trackingConfig as Record<string, unknown>) ?? {}
        const qb = (tracking.queueBoard as { enabled?: boolean } | undefined) ?? undefined
        if (qb?.enabled) setQueueBoard({ enabled: true })
      })
  }, [storeSlug])

  return (
    <div className="sf-confirm-screen">
      <div className="sf-confirm-card">
        <div className="sf-confirm-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 32, height: 32 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="sf-confirm-title">Pedido confirmado</h1>
        <p className="sf-confirm-sub">
          {orderId ? `Pedido #${orderId} recibido.` : 'Tu pedido fue recibido.'}{' '}
          {waParam && showWhatsappBtn ? 'Toca el boton para enviarlo por WhatsApp.' : ''}
        </p>

        {showTrackBtn && (deliveryId || pickupId) && !queueBoard?.enabled && (
          <a
            href={pickupId ? `/order/${pickupId}` : `/delivery/${deliveryId}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              background: '#7C3AED', color: 'white', borderRadius: 12, padding: '13px 20px',
              textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: 12,
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            Rastrear mi pedido
          </a>
        )}

        {queueBoard?.enabled && origin && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 14, lineHeight: 1.4 }}>
              Escanea aqui para saber el estatus de tu pedido
            </div>
            <QRCodeSVG
              value={`${origin}/${storeSlug}/estado`}
              size={160}
              bgColor="#ffffff"
              fgColor="#0F172A"
            />
          </div>
        )}

        {showWhatsappBtn && waParam && (
          <a href={waParam} className="sf-confirm-wa">
            {WA_ICON}
            Enviar pedido por WhatsApp
          </a>
        )}

        {showMapBtn && mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              background: '#F1F5F9', color: '#0F172A', borderRadius: 12, padding: '13px 20px',
              textDecoration: 'none', fontWeight: 600, fontSize: 14, marginBottom: 12,
              border: '1.5px solid #E2E8F0',
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
            </svg>
            Como llegar a la tienda
          </a>
        )}

        <Link href={`/${storeSlug}`} className="sf-confirm-link" style={{ display: 'block', marginTop: 16 }}>
          Volver a la tienda
        </Link>
      </div>
    </div>
  )
}

export default function PedidoPage() {
  return (
    <Suspense>
      <PedidoContent />
    </Suspense>
  )
}
