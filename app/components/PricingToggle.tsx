'use client'

import { useState } from 'react'

export default function PricingToggle() {
  const [annual, setAnnual] = useState(true)

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="pricing-toggle">
        <button className={`toggle-opt ${!annual ? 'active' : ''}`} onClick={() => setAnnual(false)}>
          Mensual
        </button>
        <button className={`toggle-opt ${annual ? 'active' : ''}`} onClick={() => setAnnual(true)}>
          Anual <span className="save">-25%</span>
        </button>
      </div>
    </div>
  )
}
