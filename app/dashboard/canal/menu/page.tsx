'use client'

import '../canal.css'

export default function Menu() {
  return (
    <div className="cn-page">
      <div className="cn-header">
        <div className="cn-title">Menú</div>
        <div className="cn-desc">Organiza tus productos por categorías y controla el orden en que aparecen.</div>
      </div>

      <div className="cn-section">
        <div className="cn-section-body">
          <div className="cn-soon-wrap">
            <div className="cn-soon-icon">🗂️</div>
            <div className="cn-soon-title">Categorías de productos</div>
            <div className="cn-soon-sub">
              Pronto podrás crear categorías como "Ropa", "Accesorios" o "Ofertas" para que tus clientes naveguen más fácil.
            </div>
            <div className="cn-soon-badge">PRÓXIMAMENTE</div>
          </div>
        </div>
      </div>

      <div className="cn-section">
        <div className="cn-section-body">
          <div className="cn-soon-wrap" style={{ padding: '32px 24px' }}>
            <div className="cn-soon-icon">⭐</div>
            <div className="cn-soon-title">Productos destacados</div>
            <div className="cn-soon-sub">
              Marca hasta 6 productos para que aparezcan primero y llamen más la atención en tu vitrina.
            </div>
            <div className="cn-soon-badge">PRÓXIMAMENTE</div>
          </div>
        </div>
      </div>
    </div>
  )
}
