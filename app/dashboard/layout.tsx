'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth, signOut } from '../lib/auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100">
          <Link href="/dashboard" className="text-xl font-bold text-indigo-600">LyteApp</Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem href="/dashboard" label="Inicio" />
          <NavItem href="/dashboard/productos" label="Productos" />
          <NavItem href="/dashboard/pedidos" label="Pedidos" />
          <NavItem href="/dashboard/tienda" label="Mi tienda" />
          <NavItem href="/dashboard/configuracion" label="Configuración" />
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 px-3 mb-2 truncate">{user.email}</p>
          <button
            onClick={() => signOut().then(() => router.push('/'))}
            className="w-full text-left text-sm text-gray-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block text-sm text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors"
    >
      {label}
    </Link>
  )
}
