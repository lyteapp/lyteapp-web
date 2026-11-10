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
