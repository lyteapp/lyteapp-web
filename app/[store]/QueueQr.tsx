'use client'

import { QRCodeSVG } from 'qrcode.react'

// Shown on the order confirmation when the store has its public queue board
// on: the customer scans it to follow every order's status on /estado.
export default function QueueQr({ url }: { url: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 14, lineHeight: 1.4 }}>
        Escanea aqui para saber el estatus de tu pedido
      </div>
      <QRCodeSVG value={url} size={160} bgColor="#ffffff" fgColor="#0F172A" />
    </div>
  )
}
