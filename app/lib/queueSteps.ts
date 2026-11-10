import { isLightColor } from './colorContrast'

// Where each order stands on the public queue board's progress bar
// (/[store]/estado, and its preview in the order-tracking editor).

export type QueueStatus = 'pending' | 'confirmed' | 'processing' | 'ready'

export const QUEUE_STEPS: Record<QueueStatus, { pct: number; label: string }> = {
  pending:    { pct: 20,  label: 'En espera' },
  confirmed:  { pct: 45,  label: 'Recibido' },
  processing: { pct: 75,  label: 'Preparando' },
  ready:      { pct: 100, label: 'Listo' },
}

export function queueStep(status: string) {
  return QUEUE_STEPS[status as QueueStatus] ?? QUEUE_STEPS.pending
}

export const QUEUE_BG_DEFAULT = '#F1F5F9'

/** The public queue screen's background (Rastreo de pedido > Cola publica):
 *  a color, or a photo darkened a little so its titles read in white. `dark`
 *  says whether the text on it should be light. */
export function queueBackground(qb: { bgColor?: string | null; bgImage?: string | null }) {
  const color = qb.bgColor || QUEUE_BG_DEFAULT
  if (qb.bgImage) {
    return { css: `linear-gradient(rgba(15,23,42,0.45), rgba(15,23,42,0.45)), url("${qb.bgImage}") center / cover no-repeat, ${color}`, dark: true }
  }
  return { css: color, dark: !isLightColor(color) }
}
