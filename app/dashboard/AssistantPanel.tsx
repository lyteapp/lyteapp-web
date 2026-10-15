'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'

type ChatMessage = { role: 'user' | 'assistant'; content: string; at: number }

const SUGGESTIONS = [
  '¿Cómo agrego un producto?',
  '¿Cómo pongo un producto en oferta?',
  '¿Cómo configuro las zonas de delivery?',
  '¿Cómo cambio los colores de mi tienda?',
]

// Renders **bold** and keeps line breaks — the assistant answers in short
// plain-text paragraphs and numbered lists.
function renderText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  )
}

const timeLabel = (at: number) => new Date(at).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' })

// Header button + chat panel for the dashboard's AI help assistant (answers
// come from /api/assistant, streamed). Laid out like a WhatsApp chat; full
// screen on phones.
export default function AssistantPanel() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [openedAt, setOpenedAt] = useState(0)
  const panelRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only on the client
  useEffect(() => setMounted(true), [])
  useEffect(() => () => abortRef.current?.abort(), [])

  const scrollToEnd = (smooth = false) => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }
  useLayoutEffect(() => { if (open) scrollToEnd() }, [open])
  // New bubble: glide to it. Streaming text: keep pinned to the bottom
  // (instantly, so it doesn't stutter) unless the merchant scrolled up.
  useEffect(() => { scrollToEnd(true) }, [messages.length])
  const lastContent = messages[messages.length - 1]?.content
  useEffect(() => {
    const el = listRef.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) scrollToEnd()
  }, [lastContent])

  function openPanel() {
    setOpenedAt(t => t || Date.now())
    setOpen(true)
    // Only on desktop: on phones the keyboard opens when the merchant taps
    // the input bar, not as soon as the chat opens.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    }
  }
  function closePanel() {
    inputRef.current?.blur()
    setOpen(false)
  }

  // Phones: keep the page behind still, and size the chat to the area the
  // keyboard leaves visible. Updated once per frame, and moved with a
  // transform (not top), so the keyboard opening doesn't make it jump.
  useEffect(() => {
    if (!open || !window.matchMedia('(max-width: 640px)').matches) return
    // iOS ignores overflow:hidden for touch scrolling, so pin the body in
    // place instead; otherwise dragging the chat drags the page behind it
    // (and the keyboard-fit below chases that movement).
    const body = document.body
    const scrollY = window.scrollY
    const prevBody = body.getAttribute('style') ?? ''
    Object.assign(body.style, { position: 'fixed', top: `-${scrollY}px`, left: '0', right: '0', overflow: 'hidden' })
    const vv = window.visualViewport
    const el = panelRef.current
    let frame = 0
    const fit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (!vv || !el) return
        const list = listRef.current
        const atEnd = !!list && list.scrollHeight - list.scrollTop - list.clientHeight < 40
        el.style.height = `${vv.height}px`
        el.style.setProperty('--db-vv-top', `${vv.offsetTop}px`)
        if (atEnd) scrollToEnd()
      })
    }
    fit()
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    return () => {
      cancelAnimationFrame(frame)
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
      body.setAttribute('style', prevBody)
      window.scrollTo(0, scrollY)
      if (el) { el.style.height = ''; el.style.removeProperty('--db-vv-top') }
    }
  }, [open])

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    const now = Date.now()
    const history: ChatMessage[] = [...messages, { role: 'user', content: q, at: now }]
    setMessages([...history, { role: 'assistant', content: '', at: now }])
    setInput('')
    setBusy(true)
    const append = (chunk: string) => setMessages(prev => {
      const next = [...prev]
      const last = next[next.length - 1]
      next[next.length - 1] = { ...last, content: last.content + chunk, at: Date.now() }
      return next
    })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), page: pathname }),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) {
        append(res.status === 503 ? 'El asistente todavía no está disponible.'
          : res.status === 429 ? await res.text()
          : 'No pude responder ahora. Intenta de nuevo.')
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        append(decoder.decode(value, { stream: true }))
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') append('No pude responder ahora. Intenta de nuevo.')
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const typing = busy && messages[messages.length - 1]?.content === ''

  return (
    <>
      <button className="db-assistant-btn" onClick={() => (open ? closePanel() : openPanel())} aria-label="Asistente virtual" aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
          <path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z" />
        </svg>
        <span className="db-assistant-btn-label">Asistente</span>
      </button>

      {/* Portaled to <body>: inside the sticky header it was trapped in the
          header's stacking context, under the sidebar and other overlays. */}
      {mounted && createPortal(<>
        {open && <div className="db-assistant-backdrop" onClick={closePanel} />}
        <aside ref={panelRef} className={`db-assistant${open ? ' open' : ''}`} aria-hidden={!open}>
          <div className="db-assistant-head">
            <button className="db-assistant-back" onClick={closePanel} aria-label="Cerrar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <div className="db-assistant-avatar" aria-hidden="true" />
            <div className="db-assistant-who">
              <div className="db-assistant-title">Asistente LyteApp</div>
              <div className="db-assistant-sub">{busy ? 'escribiendo…' : 'en línea'}</div>
            </div>
            <button className="db-assistant-close" onClick={closePanel} aria-label="Cerrar">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 5L5 15M5 5l10 10" /></svg>
            </button>
          </div>

          <div className="db-assistant-list" ref={listRef}>
            <div className="db-assistant-day">Hoy</div>
            <div className="db-assistant-msg assistant tail">
              Hola 👋 Soy el asistente de LyteApp. Pregúntame lo que quieras sobre tu panel.
              <span className="db-assistant-meta">{openedAt ? timeLabel(openedAt) : ''}</span>
            </div>
            {messages.length === 0 && (
              <div className="db-assistant-sugs">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="db-assistant-sug" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            )}
            {messages.map((m, i) => {
              if (m.role === 'assistant' && !m.content) return null
              const tail = i === 0 || messages[i - 1].role !== m.role
              const answered = m.role === 'user' && messages[i + 1]?.content
              return (
                <div key={i} className={`db-assistant-msg ${m.role}${tail ? ' tail' : ''}`}>
                  {renderText(m.content)}
                  <span className="db-assistant-meta">
                    {timeLabel(m.at)}
                    {m.role === 'user' && (
                      <svg className={`db-assistant-ticks${answered ? ' read' : ''}`} viewBox="0 0 18 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 6l3.5 3.5L11 2" /><path d="M7.5 9.5L14 2" />
                      </svg>
                    )}
                  </span>
                </div>
              )
            })}
            {typing && (
              <div className="db-assistant-msg assistant tail db-assistant-typing-bubble">
                <span className="db-assistant-typing"><i /><i /><i /></span>
              </div>
            )}
          </div>

          <form className="db-assistant-form" onSubmit={e => { e.preventDefault(); send(input) }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                // Enter sends on desktop; on phones Enter is a new line and
                // the send button sends, as in WhatsApp.
                if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                  e.preventDefault(); send(input)
                }
              }}
              placeholder="Escribe tu duda"
              rows={1}
              maxLength={2000}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar" onPointerDown={e => e.preventDefault()}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" /></svg>
            </button>
          </form>
        </aside>
      </>, document.body)}
    </>
  )
}
