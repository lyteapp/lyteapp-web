import Link from 'next/link'

export default function Dashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Panel de administración</h1>
        <p className="text-gray-500 mt-1">Bienvenido a tu tienda LyteApp</p>
      </div>

      {/* Setup banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8">
        <h2 className="font-semibold text-indigo-800 mb-1">Configura tu tienda</h2>
        <p className="text-sm text-indigo-600 mb-4">
          Completa estos pasos para empezar a vender.
        </p>
        <div className="space-y-2">
          <SetupStep step={1} label="Crea tu cuenta" done />
          <SetupStep step={2} label="Configura tu tienda" href="/dashboard/tienda" />
          <SetupStep step={3} label="Agrega tus primeros productos" href="/dashboard/productos" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Ventas hoy" value="$0" />
        <StatCard label="Pedidos pendientes" value="0" />
        <StatCard label="Productos activos" value="0" />
      </div>

      {/* Quick actions */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Acciones rápidas</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ActionCard
          href="/dashboard/productos"
          title="Agregar producto"
          description="Sube fotos, precio y descripción"
        />
        <ActionCard
          href="/dashboard/tienda"
          title="Personalizar tienda"
          description="Cambia colores, logo y banner"
        />
      </div>
    </div>
  )
}

function SetupStep({ step, label, done, href }: { step: number; label: string; done?: boolean; href?: string }) {
  const inner = (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${done ? 'opacity-50' : 'hover:bg-indigo-100 cursor-pointer'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-green-500 text-white' : 'bg-indigo-200 text-indigo-700'}`}>
        {done ? '✓' : step}
      </div>
      <span className={`text-sm ${done ? 'line-through text-gray-400' : 'text-indigo-700'}`}>{label}</span>
    </div>
  )

  if (href && !done) return <Link href={href}>{inner}</Link>
  return inner
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  )
}

function ActionCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all block">
      <p className="font-semibold text-gray-800 mb-1">{title}</p>
      <p className="text-sm text-gray-500">{description}</p>
    </Link>
  )
}
