'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { supabase } from '../lib/supabase'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

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

// Header button + slide-in chat panel for the dashboard's AI help assistant
// (answers come from /api/assistant, streamed).
export default function AssistantPanel() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, open])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  // Fit the panel to the part of the screen the phone keyboard leaves
  // visible, so the header and the input both stay in view while typing.
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const vv = window.visualViewport
    const el = panelRef.current
    if (!open || !vv || !el) return
    const fit = () => {
      el.style.height = `${vv.height}px`
      el.style.top = `${vv.offsetTop}px`
    }
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    return () => {
      vv.removeEventListener('resize', fit)
      vv.removeEventListener('scroll', fit)
      el.style.height = ''
      el.style.top = ''
    }
  }, [open, mounted])
  useEffect(() => () => abortRef.current?.abort(), [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only on the client
  useEffect(() => setMounted(true), [])

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    const history: ChatMessage[] = [...messages, { role: 'user', content: q }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setInput('')
    setBusy(true)
    const append = (chunk: string) => setMessages(prev => {
      const next = [...prev]
      next[next.length - 1] = { role: 'assistant', content: next[next.length - 1].content + chunk }
      return next
    })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ messages: history, page: pathname }),
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

  return (
    <>
      <button className="db-assistant-btn" onClick={() => setOpen(o => !o)} aria-label="Asistente virtual" aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
          <path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8z" />
        </svg>
        <span className="db-assistant-btn-label">Asistente</span>
      </button>

      {/* Portaled to <body>: inside the sticky header it was trapped in the
          header's stacking context, under the sidebar and other overlays. */}
      {mounted && createPortal(<>
      {open && <div className="db-assistant-backdrop" onClick={() => setOpen(false)} />}
      <aside ref={panelRef} className={`db-assistant${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="db-assistant-head">
          <div>
            <div className="db-assistant-title">Asistente LyteApp</div>
            <div className="db-assistant-sub">Pregúntame cómo usar tu panel</div>
          </div>
          <button className="db-assistant-close" onClick={() => setOpen(false)} aria-label="Cerrar">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 5L5 15M5 5l10 10" /></svg>
          </button>
        </div>

        <div className="db-assistant-list" ref={listRef}>
          {messages.length === 0 ? (
            <div className="db-assistant-empty">
              <p>Hola 👋 Soy el asistente de LyteApp. ¿En qué te ayudo?</p>
              <div className="db-assistant-sugs">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="db-assistant-sug" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : messages.map((m, i) => (
            <div key={i} className={`db-assistant-msg ${m.role}`}>
              {m.content
                ? renderText(m.content)
                : <span className="db-assistant-typing"><i /><i /><i /></span>}
            </div>
          ))}
        </div>

        <form className="db-assistant-form" onSubmit={e => { e.preventDefault(); send(input) }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Escribe tu duda…"
            rows={1}
            maxLength={2000}
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M3.1 3.3a.75.75 0 01.8-.1l13 6.1a.75.75 0 010 1.4l-13 6.1a.75.75 0 01-1-.9L4.6 10 2.9 4.1a.75.75 0 01.2-.8zM6 10.75l-1.2 4.3L14.6 10 4.8 4.95 6 9.25h4.25a.75.75 0 010 1.5H6z" /></svg>
          </button>
        </form>
      </aside>
      </>, document.body)}
    </>
  )
}
