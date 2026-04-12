'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sprout } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

export default function RegisterPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [form, setForm] = useState({ nome: '', email: '', senha: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao cadastrar'); return }
      login(data.user, data.token)
      router.push('/dashboard')
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-green-100 mb-1">{label}</label>
      <input
        type={type}
        value={(form as any)[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        required
        className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder:text-green-200 focus:outline-none focus:ring-2 focus:ring-white/50 transition"
      />
    </div>
  )

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-2xl animate-slide-in">
      <div className="flex flex-col items-center mb-6">
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-3">
          <Sprout className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-white">Criar Conta DeckFarm</h1>
        <p className="text-green-200 text-sm">Gestão Agrícola Inteligente</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {field('Nome completo', 'nome', 'text', 'Seu nome')}
        {field('Email', 'email', 'email', 'seu@email.com')}
        {field('Senha', 'senha', 'password', '••••••••')}
        {error && (
          <div className="bg-red-500/20 border border-red-400/30 text-red-100 text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-green-700 font-semibold py-3 rounded-xl hover:bg-green-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading ? 'Criando...' : 'Criar Conta'}
        </button>
      </form>

      <p className="text-center text-green-200 text-sm mt-5">
        Já tem conta?{' '}
        <Link href="/login" className="text-white font-semibold hover:underline">Entrar</Link>
      </p>
    </div>
  )
}
