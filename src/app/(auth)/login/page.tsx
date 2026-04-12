'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sprout, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao entrar'); return }
      login(data.user, data.token)
      router.push('/dashboard')
    } catch {
      setError('Erro de conexão. Verifique sua internet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-2xl animate-slide-in">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
          <Sprout className="w-9 h-9 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-white">DeckFarm</h1>
        <p className="text-green-200 text-sm mt-1">Gestão Agrícola Inteligente</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-green-100 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder:text-green-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-green-100 mb-1">Senha</label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder:text-green-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition pr-12"
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-3.5 text-green-200 hover:text-white">
              {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-500/20 border border-red-400/30 text-red-100 text-sm px-4 py-2 rounded-lg">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-green-700 font-semibold py-3 rounded-xl hover:bg-green-50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="text-center text-green-200 text-sm mt-6">
        Não tem conta?{' '}
        <Link href="/register" className="text-white font-semibold hover:underline">Criar conta</Link>
      </p>
    </div>
  )
}
