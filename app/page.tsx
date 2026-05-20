import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-white px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold text-indigo-600 mb-4">LyteApp</h1>
        <p className="text-xl text-gray-600 mb-2">
          Crea tu tienda en línea en minutos.
        </p>
        <p className="text-gray-500 mb-10">
          Diseña tu catálogo, gestiona pedidos y haz crecer tu negocio — todo desde un solo lugar.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/registro"
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/login"
            className="border border-indigo-600 text-indigo-600 px-8 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  )
}
