import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black min-h-screen">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          src="/logo.png"
          alt="LyteApp"
          width={60}
          height={60}
          priority
        />

        <div className="flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
          <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">
            LyteApp
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Crea tu tienda en línea, gestiona tu catálogo y recibe pedidos — todo desde un solo lugar.
          </p>
        </div>

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Link
            href="/registro"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#7C3AED] px-6 text-white transition-colors hover:bg-[#6D28D9] md:w-auto"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-6 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-auto"
          >
            Iniciar sesión
          </Link>
        </div>
      </main>
    </div>
  )
}
