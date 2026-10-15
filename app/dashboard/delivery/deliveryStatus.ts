// Delivery status labels and colors shared by the map pins and the order
// cards around it (kept out of MapView so importing them doesn't pull
// mapbox into the page bundle).
export const PIN_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', preparing: 'Preparando', ready: 'Listo',
  picked_up: 'En ruta', delivered: 'Entregado', cancelled: 'Cancelado',
}
export const PIN_STATUS_COLOR: Record<string, string> = {
  pending: '#94A3B8', preparing: '#F59E0B', ready: '#3B82F6',
  picked_up: '#1C1B3A', delivered: '#10B981', cancelled: '#EF4444',
}
export const isActiveStatus = (s: string) => s !== 'delivered' && s !== 'cancelled'
