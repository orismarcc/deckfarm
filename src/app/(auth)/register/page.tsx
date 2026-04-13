'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sprout, ArrowRight } from 'lucide-react'
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

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '0.75rem',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: '0.9375rem',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(110,231,183,0.5)'
    e.target.style.boxShadow = '0 0 0 3px rgba(110,231,183,0.1)'
  }
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.15)'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div className="animate-enter" style={{ animationDelay: '0ms' }}>
      <div className="flex flex-col items-center mb-8">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <Sprout className="w-8 h-8" style={{ color: '#6ee7b7' }} />
        </div>
        <h1 className="font-display text-3xl font-bold" style={{ color: '#fff' }}>
          DeckFarm
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Crie sua conta e comece a gerenciar
        </p>
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '1.25rem',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(20px)',
          padding: '2rem',
        }}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="section-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Nome completo</label>
            <input
              type="text"
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              placeholder="Seu nome"
              required
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <div className="space-y-1.5">
            <label className="section-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="seu@email.com"
              required
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          <div className="space-y-1.5">
            <label className="section-label" style={{ color: 'rgba(255,255,255,0.5)' }}>Senha</label>
            <input
              type="password"
              value={form.senha}
              onChange={e => set('senha', e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '0.75rem',
                padding: '0.75rem 1rem',
                color: '#fca5a5',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.8125rem 1rem',
              borderRadius: '0.75rem',
              background: loading ? 'rgba(110,231,183,0.4)' : 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
              border: 'none',
              color: '#052e16',
              fontWeight: '600',
              fontSize: '0.9375rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(52,211,153,0.3)',
              transition: 'opacity 0.15s, transform 0.15s',
            }}
          >
            {loading ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Já tem conta?{' '}
          <Link href="/login" style={{ color: '#6ee7b7', fontWeight: '600' }} className="hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
