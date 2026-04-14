'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import type { FazendaMembro, MembroRole } from '@/types'
import { UserPlus, Trash2, Crown, FlaskConical, Wrench, Eye, Copy, Check, RefreshCw } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

const roleConfig: Record<MembroRole, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  admin:    { label: 'Administrador', color: 'hsl(160 84% 22%)',  bg: 'hsl(160 84% 22% / 0.10)', icon: <Crown size={11} /> },
  agronomo: { label: 'Agrônomo',      color: 'hsl(210 90% 40%)',  bg: 'hsl(210 90% 95%)',         icon: <FlaskConical size={11} /> },
  tecnico:  { label: 'Técnico',       color: 'hsl(38 90% 38%)',   bg: 'hsl(38 90% 95%)',          icon: <Wrench size={11} /> },
  operador: { label: 'Operador',      color: 'hsl(265 55% 45%)',  bg: 'hsl(265 55% 96%)',         icon: <Eye size={11} /> },
}

const roleOptions = [
  { value: 'admin',    label: 'Administrador' },
  { value: 'agronomo', label: 'Agrônomo' },
  { value: 'tecnico',  label: 'Técnico' },
  { value: 'operador', label: 'Operador' },
]

export function MembrosSection({ fazendaId }: { fazendaId: string }) {
  const { token } = useAuthStore()
  const [membros, setMembros] = useState<FazendaMembro[]>([])
  const [carregando, setCarregando] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', role: 'tecnico' as MembroRole })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // Estado após criação de conta
  const [senhaCriada, setSenhaCriada] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(async () => {
    if (!token) return
    setCarregando(true)
    try {
      const res = await fetch(`/api/fazendas/${fazendaId}/membros`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMembros(data.membros || [])
      }
    } catch {
      // offline mode — silently skip
    } finally {
      setCarregando(false)
    }
  }, [fazendaId, token])

  useEffect(() => { carregar() }, [carregar])

  async function convidar() {
    if (!form.email || !token) return
    setLoading(true)
    setErro('')
    try {
      const res = await fetch(`/api/fazendas/${fazendaId}/membros`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nome: form.nome, email: form.email, role: form.role }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro ao adicionar membro')
        return
      }

      // Se conta foi criada, mostrar a senha
      if (data.contaCriada && data.senhaTemporaria) {
        setSenhaCriada(data.senhaTemporaria)
      }

      if (data.membro) setMembros(prev => [...prev, data.membro])
      setModalOpen(false)
      setForm({ nome: '', email: '', role: 'tecnico' })
    } catch {
      setErro('Erro de conexão. Verifique sua internet.')
    } finally {
      setLoading(false)
    }
  }

  async function remover(membroId: string, nomeDisplay: string) {
    if (!confirm(`Remover "${nomeDisplay}" desta fazenda?`)) return
    if (!token) return

    try {
      const res = await fetch(
        `/api/fazendas/${fazendaId}/membros?membroId=${membroId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (res.ok) {
        setMembros(prev => prev.filter(m => m.id !== membroId))
      }
    } catch {
      alert('Erro ao remover membro.')
    }
  }

  async function copiarSenha() {
    if (!senhaCriada) return
    try {
      await navigator.clipboard.writeText(senhaCriada)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // fallback para browsers sem clipboard API
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>Equipe da Fazenda</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            {carregando ? 'Carregando...' : `${membros.length} membro${membros.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={carregar}
            className="p-1.5 rounded-lg transition"
            style={{ color: 'var(--fg-subtle)' }}
            title="Recarregar membros"
          >
            <RefreshCw size={13} className={carregando ? 'animate-spin' : ''} />
          </button>
          <Button
            size="sm"
            onClick={() => { setModalOpen(true); setErro('') }}
            style={{ background: 'hsl(160 84% 22%)', color: 'white', boxShadow: '0 2px 8px rgba(10,91,50,0.25)' }}
          >
            <UserPlus size={13} /> Adicionar
          </Button>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {membros.length === 0 && !carregando && (
          <div className="text-center py-8 rounded-xl" style={{ background: 'var(--bg)', border: '1px dashed var(--borda)' }}>
            <p className="text-sm" style={{ color: 'var(--fg-subtle)' }}>Nenhum membro adicionado ainda</p>
            <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)', opacity: 0.7 }}>
              Adicione agrônomos e técnicos para colaborar
            </p>
          </div>
        )}
        {membros.map(m => {
          const rc = roleConfig[m.role]
          const nomeDisplay = m.usuario_nome || m.usuario_email
          const initials = nomeDisplay.substring(0, 2).toUpperCase()
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'var(--bg)', border: '1px solid var(--borda)' }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'hsl(160 84% 22% / 0.12)', color: 'hsl(160 84% 22%)' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate" style={{ color: 'var(--fg)' }}>
                  {nomeDisplay}
                </div>
                <div className="text-xs truncate" style={{ color: 'var(--fg-muted)' }}>{m.usuario_email}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ color: rc.color, background: rc.bg }}
                >
                  {rc.icon} {rc.label}
                </span>
                {m.status === 'pendente' && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: 'hsl(38 90% 95%)', color: 'hsl(38 90% 40%)' }}
                  >
                    Pendente
                  </span>
                )}
                <button
                  onClick={() => remover(m.id, nomeDisplay)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: 'var(--fg-subtle)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'hsl(4 72% 50%)'; e.currentTarget.style.background = 'hsl(4 80% 97%)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-subtle)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de senha criada */}
      {senhaCriada && (
        <Modal
          open={!!senhaCriada}
          onClose={() => setSenhaCriada(null)}
          title="Conta criada com sucesso!"
          footer={
            <Button onClick={() => setSenhaCriada(null)} className="w-full">
              Entendido
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl p-4 text-center" style={{ background: 'hsl(160 84% 22% / 0.08)', border: '1px solid hsl(160 84% 22% / 0.2)' }}>
              <p className="text-xs font-medium mb-3" style={{ color: 'hsl(160 84% 22%)' }}>
                Senha temporária do novo membro:
              </p>
              <div className="flex items-center justify-between gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--borda)' }}>
                <code className="text-base font-mono font-bold tracking-wider" style={{ color: 'var(--fg)' }}>
                  {senhaCriada}
                </code>
                <button
                  onClick={copiarSenha}
                  className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                  style={{ color: copiado ? 'hsl(160 84% 22%)' : 'var(--fg-subtle)', background: 'var(--bg-dark)' }}
                >
                  {copiado ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <p className="text-xs text-center" style={{ color: 'var(--fg-muted)' }}>
              Repasse esta senha ao membro. Ele poderá alterá-la no primeiro acesso em <strong>Perfil → Alterar Senha</strong>.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal de convite */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Adicionar Membro"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button
              onClick={convidar}
              loading={loading}
              className="flex-1"
              style={{ background: 'hsl(160 84% 22%)', color: 'white' }}
            >
              Adicionar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome completo"
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            placeholder="Ex: João da Silva"
          />
          <Input
            label="E-mail do membro"
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="joao@empresa.com.br"
          />
          <Select
            label="Função / Nível de acesso"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value as MembroRole }))}
            options={roleOptions}
          />

          {erro && (
            <div className="rounded-xl p-3 text-xs" style={{ background: 'hsl(4 80% 97%)', color: 'hsl(4 72% 45%)' }}>
              {erro}
            </div>
          )}

          <div className="rounded-xl p-3 text-xs" style={{ background: 'hsl(210 100% 97%)', color: 'hsl(210 80% 38%)' }}>
            Se o e-mail não tiver conta, uma será criada automaticamente com senha temporária que você deverá repassar ao membro.
          </div>
        </div>
      </Modal>
    </div>
  )
}
