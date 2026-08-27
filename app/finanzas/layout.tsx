import type { Metadata } from 'next'
import FinanzasShell from './FinanzasShell'
import './finanzas.css'

// Kept as a server component purely so the segment can export metadata —
// the shell itself needs hooks, so it lives in its own client component.
export const metadata: Metadata = {
  title: 'Finanzas · Lyteapp',
  description: 'Ingresos, gastos y resumen mensual del negocio',
}

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  return <FinanzasShell>{children}</FinanzasShell>
}
