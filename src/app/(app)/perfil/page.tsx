'use client'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { useThemeStore, applyTheme, type Theme } from '@/store/theme'
import {
  User, Lock, Sun, Moon, Monitor, CheckCircle2, AlertCircle,
  ChevronLeft, Eye, EyeOff, LogOut, Bell
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/* ── small helpers ─────────────────────────────────────────────── */
function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card animate-enter overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--borda)' }}>
        <div className="icon-sq w-8 h-8 icon-sq-verde rounded-lg flex items-center justify-center">
          <Icon size={15} />
        </div>
        <h2 className="font-semibold text-[0.9375rem]" style={{ color: 'var(--fg)' }}>{title}</h2>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="section-label">{label}</label>
      {children}
    </div>
  )
}

const inputCls: React.CSSProperties = {
  width: '100%', height: '2.625rem',
  paddingLeft: '0.875rem', paddingRight: '0.875rem',
  borderRadius: '0.5rem',
  border: '1.5px solid var(--borda)',
  background: 'var(--bg)',
  color: 'var(--fg)',
  fontSize: '0.9rem', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}
const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'hsl(160 84% 22%)'
  e.target.style.boxShadow   = '0 0 0 3px hsl(160 84% 22% / 0.10)'
}
const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.borderColor = 'var(--borda)'
  e.target.style.boxShadow   = 'none'
}

/* ── Alert feedback ────────────────────────────────────────────── */
function Feedback({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-sm"
      style={{
        background: type === 'success' ? 'hsl(142 60% 94%)' : 'hsl(4 80% 97%)',
        border: `1px solid ${type === 'success' ? 'hsl(142 72% 30% / 0.25)' : 'hsl(4 72% 85%)'}`,
      }}
    >
      {type === 'success'
        ? <CheckCircle2 size={14} className="flex-shrink-0 mt-px" style={{ color: 'hsl(142 72% 28%)' }} />
        : <AlertCircle  size={14} className="flex-shrink-0 mt-px" style={{ color: 'hsl(4 72% 50%)'  }} />
      }
      <span style={{ color: type === 'success' ? 'hsl(142 72% 22%)' : 'hsl(4 72% 38%)' }}>{msg}</span>
    </div>
  )
}

/* ── Theme pill ─────────────────────────────────────────────────── */
const themeOptions: { key: Theme; label: string; Icon: React.ElementType }[] = [
  { key: 'light',  label: 'Claro',   Icon: Sun     },
  { key: 'dark',   label: 'Escuro',  Icon: Moon    },
  { key: 'system', label: 'Sistema', Icon: Monitor },
]

/* ── Submit button ─────────────────────────────────────────────── */
function SaveBtn({ loading, label = 'Salvar' }: { loading: boolean; label?: string }) {
  return (
    <button type="submit" disabled={loading}
      className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
      style={{
        background: loading ? 'hsl(160 84% 32%)' : 'hsl(160 84% 22%)',
        boxShadow: loading ? 'none' : '0 4px 16px hsl(160 84% 22% / 0.28)',
        cursor: loading ? 'not-allowed' : 'pointer',
        border: 'none',
      }}
    >
      {loading && <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
      {loading ? 'Salvando...' : label}
    </button>
  )
}

/* ════════════════════════════════════════════════════════════════ */
export default function PerfilPage() {
  const router = useRouter()
  const { user, token, updateUser, logout } = useAuthStore()
  const { theme, setTheme } = useThemeStore()

  // Apply saved theme on mount
  useEffect(() => { applyTheme(theme) }, [theme])

  /* ── Nome / Apelido ─── */
  const [nome,     setNome]     = useState(user?.nome || '')
  const [apelido,  setApelido]  = useState(user?.apelido || '')
  const [nomeLoad, setNomeLoad] = useState(false)
  const [nomeFeed, setNomeFeed] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setNomeLoad(true); setNomeFeed(null)
    try {
      const res  = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nome, apelido }),
      })
      const data = await res.json()
      if (!res.ok) { setNomeFeed({ type: 'error', msg: data.error }); return }
      updateUser({ nome: nome.trim(), apelido: apelido.trim() || undefined })
      setNomeFeed({ type: 'success', msg: 'Perfil atualizado com sucesso!' })
    } catch {
      setNomeFeed({ type: 'error', msg: 'Erro de conexão.' })
    } finally { setNomeLoad(false) }
  }

  /* ── Senha ─── */
  const [pwd, setPwd] = useState({ atual: '', nova: '', confirmar: '' })
  const [showPwd, setShowPwd] = useState({ atual: false, nova: false, confirmar: false })
  const [pwdLoad, setPwdLoad] = useState(false)
  const [pwdFeed, setPwdFeed] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  async function savePwd(e: React.FormEvent) {
    e.preventDefault()
    if (pwd.nova !== pwd.confirmar) { setPwdFeed({ type: 'error', msg: 'As senhas não coincidem.' }); return }
    if (pwd.nova.length < 8) { setPwdFeed({ type: 'error', msg: 'Nova senha precisa ter ao menos 8 caracteres.' }); return }
    setPwdLoad(true); setPwdFeed(null)
    try {
      const res  = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ senhaAtual: pwd.atual, novaSenha: pwd.nova }),
      })
      const data = await res.json()
      if (!res.ok) { setPwdFeed({ type: 'error', msg: data.error }); return }
      setPwd({ atual: '', nova: '', confirmar: '' })
      setPwdFeed({ type: 'success', msg: 'Senha alterada com sucesso!' })
    } catch {
      setPwdFeed({ type: 'error', msg: 'Erro de conexão.' })
    } finally { setPwdLoad(false) }
  }

  /* ── Notif toggle (3rd basic feature) ─── */
  const [notifSound, setNotifSound] = useState(() => {
    if (typeof localStorage === 'undefined') return true
    return localStorage.getItem('deckfarm-notif-sound') !== 'false'
  })
  function toggleNotifSound() {
    const next = !notifSound
    setNotifSound(next)
    localStorage.setItem('deckfarm-notif-sound', String(next))
  }

  function handleLogout() {
    logout()
    router.push('/login')
  }

  const initials = user?.nome?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'

  /* ── Password field helper ─── */
  const PwdField = ({ k, label }: { k: 'atual' | 'nova' | 'confirmar'; label: string }) => (
    <FieldRow label={label}>
      <div style={{ position: 'relative' }}>
        <input
          type={showPwd[k] ? 'text' : 'password'}
          value={pwd[k]}
          onChange={e => setPwd(p => ({ ...p, [k]: e.target.value }))}
          placeholder="••••••••"
          required
          style={{ ...inputCls, paddingRight: '2.5rem' }}
          onFocus={onFocus} onBlur={onBlur}
        />
        <button type="button" tabIndex={-1}
          onClick={() => setShowPwd(p => ({ ...p, [k]: !p[k] }))}
          style={{ position: 'absolute', right: '0.625rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', display: 'flex', alignItems: 'center' }}
        >
          {showPwd[k] ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </FieldRow>
  )

  return (
    <div className="px-4 py-6 md:px-8 max-w-2xl mx-auto pb-28 md:pb-10">

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="animate-enter flex items-center gap-3 mb-8">
        <Link href="/dashboard"
          className="p-2 rounded-xl transition-colors flex items-center justify-center"
          style={{ border: '1.5px solid var(--borda)', color: 'var(--fg-muted)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-dark)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <ChevronLeft size={16} />
        </Link>
        <div>
          <p className="section-label mb-0.5">Conta</p>
          <h1 className="font-display text-[1.625rem] font-bold" style={{ color: 'var(--fg)' }}>
            Meu Perfil
          </h1>
        </div>
      </div>

      {/* ── Avatar card ──────────────────────────────────────── */}
      <div className="animate-enter-1 card p-5 flex items-center gap-4 mb-5">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
          style={{
            background: 'hsl(160 84% 22% / 0.12)',
            border: '2px solid hsl(160 84% 22% / 0.25)',
            color: 'hsl(160 84% 22%)',
          }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate" style={{ color: 'var(--fg)' }}>{user?.nome}</div>
          <div className="text-sm truncate" style={{ color: 'var(--fg-muted)' }}>{user?.email}</div>
          <div className="mt-1.5">
            <span className="badge-status badge-success text-[10px]">
              ✓ Conta ativa
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">

        {/* ── Informações pessoais ─────────────────────────── */}
        <div className="animate-enter-2">
          <SectionCard title="Informações Pessoais" icon={User}>
            <form onSubmit={saveName} className="flex flex-col gap-4">
              <FieldRow label="Nome completo">
                <input
                  type="text" value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome completo" required
                  style={inputCls} onFocus={onFocus} onBlur={onBlur}
                />
              </FieldRow>
              <FieldRow label="Como quer ser chamado">
                <input
                  type="text" value={apelido} onChange={e => setApelido(e.target.value)}
                  placeholder="Ex: João, Zé, Dr. Silva... (opcional)"
                  style={inputCls} onFocus={onFocus} onBlur={onBlur}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--fg-subtle)' }}>
                  Exibido no app para cumprimentos e saudações
                </span>
              </FieldRow>
              <FieldRow label="Email">
                <input
                  type="email" value={user?.email || ''} disabled
                  style={{ ...inputCls, opacity: 0.55, cursor: 'not-allowed' }}
                />
              </FieldRow>
              {nomeFeed && <Feedback {...nomeFeed} />}
              <div className="flex justify-end">
                <SaveBtn loading={nomeLoad} label="Salvar perfil" />
              </div>
            </form>
          </SectionCard>
        </div>

        {/* ── Aparência ────────────────────────────────────── */}
        <div className="animate-enter-3">
          <SectionCard title="Aparência" icon={Sun}>
            <div className="flex flex-col gap-3">
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                Escolha o tema da interface
              </p>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map(({ key, label, Icon }) => {
                  const active = theme === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTheme(key)}
                      className="flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl transition-all"
                      style={{
                        border: active ? '2px solid hsl(160 84% 22%)' : '1.5px solid var(--borda)',
                        background: active ? 'hsl(160 84% 22% / 0.07)' : 'var(--bg)',
                        cursor: 'pointer',
                      }}
                    >
                      <Icon size={20} style={{ color: active ? 'hsl(160 84% 22%)' : 'var(--fg-muted)' }} />
                      <span
                        className="text-xs font-semibold"
                        style={{ color: active ? 'hsl(160 84% 22%)' : 'var(--fg-muted)' }}
                      >
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Notificações ─────────────────────────────────── */}
        <div className="animate-enter-4">
          <SectionCard title="Notificações" icon={Bell}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--fg)' }}>Sons de alerta</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
                    Reproduzir som ao receber notificações
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleNotifSound}
                  className="relative flex-shrink-0"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  aria-label="Toggle notificação sonora"
                >
                  <div
                    className="w-12 h-6 rounded-full transition-all duration-200"
                    style={{
                      background: notifSound ? 'hsl(160 84% 22%)' : 'var(--borda)',
                      boxShadow: notifSound ? '0 0 0 2px hsl(160 84% 22% / 0.20)' : 'none',
                    }}
                  >
                    <div
                      className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all duration-200"
                      style={{ left: notifSound ? 'calc(100% - 21px)' : '3px' }}
                    />
                  </div>
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--borda)', paddingTop: '1rem' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--fg)' }}>Alertas de prazo</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
                      Notificar 1 dia antes das aplicações vencerem
                    </p>
                  </div>
                  <div
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'hsl(160 84% 22% / 0.10)', color: 'hsl(160 84% 22%)' }}
                  >
                    Ativo
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ── Segurança ────────────────────────────────────── */}
        <div className="animate-enter-5">
          <SectionCard title="Segurança" icon={Lock}>
            <form onSubmit={savePwd} className="flex flex-col gap-4">
              <PwdField k="atual"     label="Senha atual"    />
              <PwdField k="nova"      label="Nova senha"     />
              <PwdField k="confirmar" label="Confirmar nova senha" />
              {pwdFeed && <Feedback {...pwdFeed} />}
              <div className="flex justify-end">
                <SaveBtn loading={pwdLoad} label="Alterar senha" />
              </div>
            </form>
          </SectionCard>
        </div>

        {/* ── Logout ───────────────────────────────────────── */}
        <div className="animate-enter-5">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>Encerrar sessão</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>
                  Sair da sua conta neste dispositivo
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
                style={{
                  background: 'hsl(4 86% 97%)',
                  border: '1.5px solid hsl(4 72% 85%)',
                  color: 'hsl(4 65% 45%)',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'hsl(4 86% 93%)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'hsl(4 86% 97%)' }}
              >
                <LogOut size={14} />
                Sair
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
