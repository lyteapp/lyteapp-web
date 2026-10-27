// The order-tracking page's wording per status, and the store's own
// replacements for it (template_config.trackingConfig.texts, set from the
// Apariencia editor). Shared by the tracking page and the editor preview.

export type TrackStatus = 'pending' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled'

export type TrackTextField =
  | 'title'  // big heading (both modes)
  | 'sub'    // text under it (both modes)
  | 'step'   // name in the status mode's list of steps
  | 'desc'   // detail under the current step in that list
  | 'short'  // map mode: name under the dot in the progress bar

export type TrackTexts = Partial<Record<TrackStatus, Partial<Record<TrackTextField, string>>>>

export const TRACK_STATUS_ORDER: TrackStatus[] = ['pending', 'preparing', 'ready', 'picked_up', 'delivered']

export const TRACK_STATUS_NAMES: Record<TrackStatus, string> = {
  pending: 'Recibido', preparing: 'Preparando', ready: 'Listo',
  picked_up: 'En camino', delivered: 'Entregado', cancelled: 'Cancelado',
}

type Defaults = Record<TrackTextField, string> & { chip: string }
export const TRACK_TEXT_DEFAULTS: Record<TrackStatus, Defaults> = {
  pending: {
    title: 'Pedido recibido', sub: 'Tu pedido fue registrado. La cocina lo tiene y comenzara a prepararlo pronto.',
    step: 'Pedido recibido', desc: 'Tu pedido fue registrado. La cocina lo tiene y comenzara a prepararlo pronto.',
    short: 'Recibido', chip: 'recibido',
  },
  preparing: {
    title: 'En preparacion en cocina', sub: 'Estamos preparando tu pedido con mucho cuidado. Te avisamos cuando salga.',
    step: 'En preparacion', desc: 'Tu pedido esta en cocina, lo estan preparando con mucho cuidado.',
    short: 'Preparando', chip: 'en preparacion',
  },
  ready: {
    title: 'Siendo empacado', sub: 'Tu pedido ya esta listo y lo estan empacando. El despachador viene pronto.',
    step: 'Siendo empacado', desc: 'Tu pedido ya esta listo y lo estan empacando para que llegue perfecto.',
    short: 'Listo', chip: 'siendo empacado',
  },
  picked_up: {
    title: 'Tu pedido esta saliendo', sub: 'El despachador ya tiene tu pedido y va en camino hacia ti.',
    step: 'Tu pedido esta saliendo', desc: 'El despachador ya tiene tu pedido y va en camino hacia ti.',
    short: 'En camino', chip: 'en camino',
  },
  delivered: {
    title: 'Tu pedido fue entregado', sub: 'Que lo disfrutes. Gracias por tu compra.',
    step: 'Pedido entregado', desc: 'Tu pedido llego exitosamente. Que lo disfrutes.',
    short: 'Entregado', chip: 'entregado',
  },
  cancelled: {
    title: 'Entrega cancelada', sub: 'Esta entrega fue cancelada. Contacta a la tienda para mas informacion.',
    step: '', desc: '', short: 'Cancelado', chip: 'cancelado',
  },
}

/** The store's text for a status, or the default. 'chip' is the map mode's
 *  small status tag — it follows the custom short name when there is one. */
export function trackText(texts: TrackTexts | null | undefined, status: string, field: TrackTextField | 'chip'): string {
  const s = (status in TRACK_TEXT_DEFAULTS ? status : 'preparing') as TrackStatus
  const own = texts?.[s]?.[field === 'chip' ? 'short' : field]?.trim()
  return own || TRACK_TEXT_DEFAULTS[s][field]
}
