'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

export default function Registro() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegistro(e: { preventDefault(): void }) {
    e.preventDefault()
    setError('')
    setMensaje('')
    setLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
    } else {
      setMensaje('¡Cuenta creada! Revisa tu email para confirmar tu cuenta.')
    }

    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-indigo-600">LyteApp</Link>
          <p className="text-gray-500 mt-2">Crea tu tienda en minutos</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-xl font-semibold text-gray-800 mb-6">Crear cuenta</h1>

          {mensaje ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-4">✉️</div>
              <p className="text-gray-700 font-medium mb-2">Revisa tu email</p>
              <p className="text-sm text-gray-500">{mensaje}</p>
              <Link
                href="/login"
                className="inline-block mt-6 text-indigo-600 font-medium hover:underline text-sm"
              >
                Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleRegistro} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
              </button>

              <p className="text-center text-xs text-gray-400 mt-2">
                Al registrarte aceptas nuestros términos de servicio.
              </p>
            </form>
          )}

          {!mensaje && (
            <p className="text-center text-sm text-gray-500 mt-6">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-indigo-600 font-medium hover:underline">
                Inicia sesión
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
