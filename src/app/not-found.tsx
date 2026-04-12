import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl font-bold text-green-600 mb-2">404</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Página não encontrada</h2>
        <p className="text-gray-500 mb-6">A página que você procura não existe.</p>
        <Link href="/dashboard" className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition inline-block">
          Ir para o Dashboard
        </Link>
      </div>
    </div>
  )
}
