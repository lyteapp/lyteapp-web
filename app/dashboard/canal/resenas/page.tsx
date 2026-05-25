'use client'

import '../canal.css'

export default function Resenas() {
  return (
    <div className="cn-page">
      <div className="cn-header">
        <div className="cn-title">Reseñas</div>
        <div className="cn-desc">Muestra la opinión de tus clientes para generar confianza y vender más.</div>
      </div>

      <div className="cn-section">
        <div className="cn-section-body">
          <div className="cn-soon-wrap">
            <div className="cn-soon-icon">⭐</div>
            <div className="cn-soon-title">Reseñas de clientes</div>
            <div className="cn-soon-sub">
              Tus compradores podrán dejar una calificación y comentario después de cada pedido. Tú decides cuáles mostrar en tu tienda.
            </div>
            <div className="cn-soon-badge">PRÓXIMAMENTE</div>
          </div>
        </div>
      </div>

      <div className="cn-section">
        <div className="cn-section-body">
          <div className="cn-soon-wrap" style={{ padding: '32px 24px' }}>
            <div className="cn-soon-icon">📊</div>
            <div className="cn-soon-title">Calificación promedio</div>
            <div className="cn-soon-sub">
              Muestra tu puntuación general en la vitrina y en los resultados de búsqueda para destacarte de la competencia.
            </div>
            <div className="cn-soon-badge">PRÓXIMAMENTE</div>
          </div>
        </div>
      </div>
    </div>
  )
}
