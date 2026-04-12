'use client'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center max-w-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Erro inesperado</h2>
            <p className="text-gray-500 mb-4">Algo deu errado. Tente novamente.</p>
            <button
              onClick={reset}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
