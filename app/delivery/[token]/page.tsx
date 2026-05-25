'use client'

import { use, useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import './tracking.css'

type Status = 'ready' | 'picked_up' | 'delivered' | 'cancelled'

interface Delivery {
  id: string; customer_name: string; customer_phone: string
  delivery_address: string; status: Status; notes: string | null
  picked_up_at: string | null; delivered_at: string | null; created_at: string
}

const STEPS: { key: Status; label: string; desc: string }[] = [
  { key: 'ready',     label: 'Pedido listo',  desc: 'Tu pedido esta listo y esperando al motorista' },
  { key: 'picked_up', label: 'En camino',     desc: 'El motorista ya lo tiene y va hacia ti' },
  { key: 'delivered', label: 'Entregado',     desc: 'Tu pedido fue entregado exitosamente' },
]

const STATUS_ORDER: Record<string, number> = { ready: 0, picked_up: 1, delivered: 2 }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
}

export default function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [delivery, setDelivery] = useState<Delivery | null | 'loading'>('loading')
  const [confirming, setConfirming] = useState(false)
  const [showDriverActions, setShowDriverActions] = useState(false)

  useEffect(() => {
    supabase.from('deliveries').select('*').eq('id', token).maybeSingle().then(({ data }) => {
      setDelivery(data ?? null)
    })
  }, [token])

  useEffect(() => {
    if (!token) return
    const ch = supabase.channel(`track-${token}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deliveries', filter: `id=eq.${token}` }, payload => {
        setDelivery(payload.new as Delivery)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [token])

  async function confirmPickup() {
    setConfirming(true)
    await supabase.from('deliveries').update({ status: 'picked_up', picked_up_at: new Date().toISOString() }).eq('id', token)
    setConfirming(false)
  }

  async function confirmDelivered() {
    setConfirming(true)
    await supabase.from('deliveries').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', token)
    setConfirming(false)
  }

  if (delivery === 'loading') {
    return (
      <div className="tr-full-center">
        <div className="tr-spinner" />
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="tr-wrap">
        <div className="tr-brand-bar">
          <span className="tr-brand">Lyte<span>app</span></span>
        </div>
        <div className="tr-notfound">
          <div className="tr-nf-icon">404</div>
          <h2 className="tr-nf-title">Entrega no encontrada</h2>
          <p className="tr-nf-sub">Este link puede ser invalido o haber expirado.</p>
        </div>
      </div>
    )
  }

  const currentStep = STATUS_ORDER[delivery.status] ?? -1
  const isCancelled = delivery.status === 'cancelled'
  const isDone      = delivery.status === 'delivered'

  return (
    <div className="tr-wrap">
      {/* Brand bar */}
      <div className="tr-brand-bar">
        <a className="tr-brand" href="https://lyte-app.com" target="_blank" rel="noreferrer">
          Lyte<span>app</span>
        </a>
        <div className="tr-brand-label">Rastreo de pedido</div>
      </div>

      {/* Main card */}
      <div className={`tr-card${isDone ? ' tr-card-done' : ''}${isCancelled ? ' tr-card-cancelled' : ''}`}>
        {/* Customer info */}
        <div className="tr-info">
          <div className="tr-customer">{delivery.customer_name}</div>
          {delivery.delivery_address && (
            <div className="tr-address">
              <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13" style={{ flexShrink: 0, marginTop: 2 }}>
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              {delivery.delivery_address}
            </div>
          )}
          {delivery.notes && <div className="tr-notes">"{delivery.notes}"</div>}
        </div>

        {/* Cancelled */}
        {isCancelled && (
          <div className="tr-cancelled-banner">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            Entrega cancelada
          </div>
        )}

        {/* Timeline */}
        {!isCancelled && (
          <div className="tr-timeline">
            {STEPS.map((step, i) => {
              const done    = i <= currentStep
              const current = i === currentStep
              const future  = i > currentStep
              return (
                <div key={step.key} className={`tr-step${done ? ' done' : ''}${current ? ' current' : ''}${future ? ' future' : ''}`}>
                  <div className="tr-step-track">
                    <div className={`tr-dot${done ? ' done' : current ? ' current' : ''}`}>
                      {done && i < currentStep ? (
                        <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10">
                          <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" clipRule="evenodd" />
                        </svg>
                      ) : current ? (
                        <div className="tr-dot-pulse" />
                      ) : (
                        <span className="tr-dot-num">{i + 1}</span>
                      )}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`tr-line${i < currentStep ? ' done' : ''}`} />
                    )}
                  </div>
                  <div className="tr-step-body">
                    <div className="tr-step-label">{step.label}</div>
                    {current && <div className="tr-step-desc">{step.desc}</div>}
                    {step.key === 'picked_up' && delivery.picked_up_at && done && (
                      <div className="tr-step-time">{fmtTime(delivery.picked_up_at)}</div>
                    )}
                    {step.key === 'delivered' && delivery.delivered_at && done && (
                      <div className="tr-step-time">{fmtTime(delivery.delivered_at)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Success banner */}
        {isDone && (
          <div className="tr-success">
            <div className="tr-success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="tr-success-title">Pedido entregado</div>
            {delivery.delivered_at && <div className="tr-success-time">{fmtTime(delivery.delivered_at)}</div>}
          </div>
        )}

        {/* Driver actions section */}
        {(delivery.status === 'ready' || delivery.status === 'picked_up') && (
          <div className="tr-driver-section">
            {!showDriverActions ? (
              <button className="tr-driver-toggle" onClick={() => setShowDriverActions(true)}>
                Soy el motorista
              </button>
            ) : (
              <div className="tr-driver-panel">
                <div className="tr-driver-panel-title">Acciones del motorista</div>
                {delivery.status === 'ready' && (
                  <button className="tr-confirm-btn" onClick={confirmPickup} disabled={confirming}>
                    {confirming ? (
                      <span className="tr-btn-spinner" />
                    ) : (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                          <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z"/>
                          <path d="M16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                        </svg>
                        Confirmar recogida
                      </>
                    )}
                  </button>
                )}
                {delivery.status === 'picked_up' && (
                  <button className="tr-confirm-btn tr-confirm-deliver" onClick={confirmDelivered} disabled={confirming}>
                    {confirming ? (
                      <span className="tr-btn-spinner" />
                    ) : (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                        Marcar como entregado
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="tr-footer">
        <a href="https://lyte-app.com" target="_blank" rel="noreferrer">
          Powered by <strong>LyteApp</strong> · Crea tu tienda gratis
        </a>
      </div>
    </div>
  )
}
