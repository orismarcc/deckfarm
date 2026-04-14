'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sprout, Mail, Lock, User, Smile, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

export default function RegisterPage() {
  const router = useRouter()
  const { login } = useAuthStore()
  const [form, setForm]       = useState({ nome: '', apelido: '', email: '', senha: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/auth/register', {
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
    } finally { setLoading(false) }
  }

  const inputBase: React.CSSProperties = {
    width: '100%', height: '2.875rem',
    paddingLeft: '2.5rem',
    borderRadius: '0.625rem',
    border: '1.5px solid hsl(214 20% 88%)',
    background: 'hsl(210 16% 97%)',
    color: 'hsl(222 47% 11%)',
    fontSize: '0.9375rem', outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'hsl(160 84% 22%)'
    e.target.style.boxShadow   = '0 0 0 3px hsl(160 84% 22% / 0.10)'
    e.target.style.background  = '#fff'
  }
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'hsl(214 20% 88%)'
    e.target.style.boxShadow   = 'none'
    e.target.style.background  = 'hsl(210 16% 97%)'
  }

  const heroGradient = 'linear-gradient(145deg, hsl(160 84% 7%) 0%, hsl(162 75% 11%) 50%, hsl(200 70% 9%) 100%)'

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── MOBILE: compact brand bar ──────────────────────────── */}
      <div
        className="md:hidden flex items-center gap-3 px-5 py-4 flex-shrink-0"
        style={{ background: heroGradient }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <Sprout className="w-4 h-4" style={{ color: '#6ee7b7' }} />
        </div>
        <div>
          <div className="font-display text-base font-bold text-white leading-none">DeckFarm</div>
          <div className="text-[9px] tracking-widest uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Gestão Agrícola
          </div>
        </div>
      </div>

      {/* ── DESKTOP: full hero panel ────────────────────────────── */}
      <div
        className="grain relative overflow-hidden hidden md:flex flex-col justify-between flex-shrink-0"
        style={{ width: '42%', padding: '3rem', minHeight: '100vh', background: heroGradient }}
      >
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '360px', height: '360px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.055) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '-60px', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Sprout className="w-5 h-5" style={{ color: '#6ee7b7' }} />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-white leading-none">DeckFarm</div>
            <div className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Gestão Agrícola
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="font-display text-[2.75rem] font-bold leading-[1.1] text-white mb-5">
            Comece agora<br />gratuitamente.
          </h1>
          <p className="text-[0.9375rem] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Crie sua conta e tenha controle completo das suas operações agrícolas.
          </p>
        </div>

        <div className="relative z-10 flex flex-col gap-3.5">
          {['Cadastro rápido, sem cartão', 'Dados salvos localmente (offline)', 'Sincronização automática em nuvem'].map(f => (
            <div key={f} className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#6ee7b7' }} />
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FORM PANEL ──────────────────────────────────────────── */}
      <div
        className="flex-1 flex items-start md:items-center justify-center bg-white pt-10 md:pt-0"
        style={{ padding: 'clamp(1.5rem, 6vw, 3rem)' }}
      >
        <div className="w-full max-w-[380px]">

          <div className="mb-8">
            <h2
              className="font-display font-bold leading-tight mb-2"
              style={{ fontSize: 'clamp(1.5rem, 5vw, 1.875rem)', color: 'hsl(160 84% 14%)' }}
            >
              Criar conta
            </h2>
            <p className="text-sm" style={{ color: 'hsl(215 16% 50%)' }}>
              Preencha os dados abaixo para começar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Nome completo */}
            <div className="flex flex-col gap-1.5">
              <label className="section-label">Nome completo</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(215 16% 55%)', pointerEvents: 'none' }} />
                <input
                  type="text" value={form.nome} onChange={e => set('nome', e.target.value)}
                  placeholder="Ex: João da Silva" required autoComplete="name"
                  style={{ ...inputBase, paddingRight: '0.875rem' }} onFocus={onFocus} onBlur={onBlur}
                />
              </div>
            </div>

            {/* Apelido */}
            <div className="flex flex-col gap-1.5">
              <label className="section-label">Como quer ser chamado?</label>
              <div style={{ position: 'relative' }}>
                <Smile size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(215 16% 55%)', pointerEvents: 'none' }} />
                <input
                  type="text" value={form.apelido} onChange={e => set('apelido', e.target.value)}
                  placeholder="Ex: João, Zé, Dr. Silva..." autoComplete="nickname"
                  style={{ ...inputBase, paddingRight: '0.875rem' }} onFocus={onFocus} onBlur={onBlur}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'hsl(215 16% 55%)' }}>
                Opcional — usaremos no app para te cumprimentar
              </span>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="section-label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(215 16% 55%)', pointerEvents: 'none' }} />
                <input
                  type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="seu@email.com" required autoComplete="email"
                  style={{ ...inputBase, paddingRight: '0.875rem' }} onFocus={onFocus} onBlur={onBlur}
                />
              </div>
            </div>

            {/* Senha */}
            <div className="flex flex-col gap-1.5">
              <label className="section-label">Senha</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(215 16% 55%)', pointerEvents: 'none' }} />
                <input
                  type={showPwd ? 'text' : 'password'} value={form.senha} onChange={e => set('senha', e.target.value)}
                  placeholder="Mínimo 8 caracteres" required autoComplete="new-password"
                  style={{ ...inputBase, paddingRight: '2.75rem' }} onFocus={onFocus} onBlur={onBlur}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(215 16% 60%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-sm"
                style={{ background: 'hsl(4 80% 97%)', border: '1px solid hsl(4 72% 85%)' }}>
                <AlertCircle size={15} className="flex-shrink-0 mt-px" style={{ color: 'hsl(4 72% 50%)' }} />
                <span style={{ color: 'hsl(4 72% 38%)' }}>{error}</span>
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 font-bold rounded-[0.75rem] transition-all active:scale-[0.98] mt-1"
              style={{
                height: '3rem', fontSize: '0.9375rem', color: '#fff', border: 'none',
                background: loading ? 'hsl(160 84% 30%)' : 'hsl(160 84% 22%)',
                boxShadow: loading ? 'none' : '0 4px 20px -2px hsl(160 84% 22% / 0.4)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                : <ArrowRight size={16} />}
              {loading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>

          <p className="text-center text-sm mt-7" style={{ color: 'hsl(215 16% 52%)' }}>
            Já tem conta?{' '}
            <Link href="/login" style={{ color: 'hsl(160 84% 22%)', fontWeight: 700 }} className="hover:underline underline-offset-2">
              Entrar
            </Link>
          </p>
        </div>
      </div>

    </div>
  )
}
