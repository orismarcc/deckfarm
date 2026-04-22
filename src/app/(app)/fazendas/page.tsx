'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { getDB } from '@/lib/db'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WeatherWidget } from '@/components/weather/weather-widget'
import { gerarId, culturaIcon } from '@/lib/utils'
import { enqueueSync, processSyncQueue } from '@/lib/db/sync'
import type { Fazenda, Talhao, Aplicacao } from '@/types'
import { Plus, MapPin, Leaf, AlertTriangle, Clock, CheckCircle, Trash2, Edit3, ChevronRight, Search, Cloud, ChevronDown } from 'lucide-react'
import Link from 'next/link'

const ESTADOS_BR = [
  { uf: 'AC', nome: 'Acre' }, { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' }, { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' }, { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' }, { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' }, { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' }, { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' }, { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' }, { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' }, { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' }, { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' }, { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' }, { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' }, { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
]

export default function FazendasPage() {
  const { user } = useAuthStore()
  const { fazendas, setFazendas, talhoes, setTalhoes, aplicacoes, setAplicacoes, addFazenda, updateFazenda, deleteFazenda, lastServerSyncAt } = useAppStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Fazenda | null>(null)
  const [form, setForm] = useState({ nome: '', localizacao: '', nome_produtor: '', area_total: '', latitude: '', longitude: '', estado: '', cidade: '' })
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')
  // weather sempre visível por card; botão permite ocultar se desejar
  const [weatherOculta, setWeatherOculta] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    if (!user) return
    const db = getDB()
    const [fazs, tals, apps] = await Promise.all([
      db.fazendas.where('usuario_id').equals(user.id).toArray(),
      db.talhoes.toArray(),
      db.aplicacoes.where('usuario_id').equals(user.id).filter(a => !a.deleted_at).toArray(),
    ])
    setFazendas(fazs); setTalhoes(tals); setAplicacoes(apps)
  }, [user, setFazendas, setTalhoes, setAplicacoes])

  useEffect(() => { loadData() }, [loadData])
  // Re-run when server pull completes so cross-device data appears immediately
  useEffect(() => { if (lastServerSyncAt > 0) loadData() }, [lastServerSyncAt]) // eslint-disable-line react-hooks/exhaustive-deps

  function openModal(f?: Fazenda) {
    if (f) {
      setEditando(f)
      const parts = (f.localizacao || '').split(' - ')
      const cidade = parts[0]?.trim() || ''
      const estado = parts[1]?.trim() || ''
      setForm({
        nome: f.nome, localizacao: f.localizacao,
        nome_produtor: f.nome_produtor || '',
        area_total: f.area_total?.toString() || '',
        latitude: f.latitude?.toString() || '',
        longitude: f.longitude?.toString() || '',
        estado,
        cidade,
      })
    } else {
      setEditando(null)
      setForm({ nome: '', localizacao: '', nome_produtor: '', area_total: '', latitude: '', longitude: '', estado: '', cidade: '' })
    }
    setModalOpen(true)
  }

  async function handleSave() {
    const localizacao = [form.cidade, form.estado].filter(Boolean).join(' - ')
    if (!user || !form.nome || !localizacao) return
    setLoading(true)
    try {
      const db = getDB()
      const now = new Date().toISOString()
      const base = {
        nome: form.nome,
        localizacao,
        nome_produtor: form.nome_produtor || undefined,
        area_total: form.area_total ? Number(form.area_total) : undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        _syncStatus: 'pending' as const,
      }
      if (editando) {
        const updated = { ...editando, ...base, updatedAt: now }
        await db.fazendas.put(updated)
        updateFazenda(editando.id, updated)
        await enqueueSync('fazenda', 'upsert', updated as unknown as Record<string, unknown>)
      } else {
        const fazenda: Fazenda = { id: gerarId(), usuario_id: user.id, createdAt: now, updatedAt: now, ...base }
        await db.fazendas.add(fazenda)
        addFazenda(fazenda)
        await enqueueSync('fazenda', 'upsert', fazenda as unknown as Record<string, unknown>)
      }
      processSyncQueue()
      setModalOpen(false)
    } finally { setLoading(false) }
  }

  async function handleDelete(f: Fazenda) {
    if (!confirm(`Excluir fazenda "${f.nome}"? Todos os talhões e dados serão perdidos.`)) return
    await getDB().fazendas.delete(f.id)
    deleteFazenda(f.id)
  }

  const filtered = fazendas.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    f.localizacao.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="px-4 py-6 md:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="animate-enter-1 flex items-start justify-between mb-8">
        <div>
          <p className="section-label mb-1">Propriedades</p>
          <h1 className="font-display text-[2rem] font-bold" style={{ color: 'var(--fg)' }}>Fazendas</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>
            {fazendas.length} fazenda{fazendas.length !== 1 ? 's' : ''} cadastrada{fazendas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 mt-1">
          <Plus size={14} /> Nova Fazenda
        </Button>
      </div>

      {/* Search */}
      {fazendas.length > 2 && (
        <div className="animate-enter-2 relative mb-6 max-w-xs">
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar fazenda..."
            className="field-input" style={{ paddingLeft: '2.25rem' }} />
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card animate-enter-2 p-14 text-center max-w-sm mx-auto">
          <div className="icon-circle icon-circle-muted w-14 h-14 mx-auto mb-4"><MapPin size={22} /></div>
          <p className="font-semibold mb-1" style={{ color: 'var(--fg)' }}>Nenhuma fazenda encontrada</p>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            {busca ? 'Tente outro termo.' : 'Clique em "Nova Fazenda" para começar.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((f, i) => {
            const talhoesF = talhoes.filter(t => t.fazenda_id === f.id)
            const appsF = aplicacoes.filter(a => talhoesF.some(t => t.id === a.talhao_id))
            const atrasadas = appsF.filter(a => a.status === 'atrasado').length
            const hoje = appsF.filter(a => a.status === 'hoje').length
            const proximas = appsF.filter(a => a.status === 'proximo').length
            const totalArea = talhoesF.reduce((acc, t) => acc + (t.area || 0), 0)
            const culturas = [...new Set(talhoesF.map(t => t.cultura))]
            const comPlantio = talhoesF.filter(t => t.data_plantio).length
            const totalAreaTalhoes = talhoesF.reduce((acc, t) => acc + (t.area || 0), 0)
            const totalSemeadoF = talhoesF.reduce((acc, t) => acc + (t.area_semeada || 0), 0)
            const pctSemeado = totalAreaTalhoes > 0 && totalSemeadoF > 0
              ? Math.min(100, Math.round((totalSemeadoF / totalAreaTalhoes) * 100))
              : 0
            const isTotalmenteSemeado = pctSemeado >= 100
            const showWeather = !weatherOculta.has(f.id) && (!!f.latitude || !!f.localizacao)

            return (
              <div key={f.id} className="card animate-enter flex flex-col" style={{ animationDelay: `${(i + 2) * 60}ms` }}>
                <div className="p-5 flex-1 space-y-4">
                  {/* Cabeçalho do card */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="icon-sq w-11 h-11 icon-sq-verde rounded-xl flex items-center justify-center">
                        <MapPin size={18} />
                      </div>
                      <div>
                        <h3 className="font-semibold leading-tight" style={{ color: 'var(--fg)' }}>{f.nome}</h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>{f.localizacao}</p>
                        {f.nome_produtor && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-subtle)' }}>Prod: {f.nome_produtor}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {(f.latitude || f.localizacao) && (
                        <button
                          onClick={() => setWeatherOculta(prev => {
                            const next = new Set(prev)
                            next.has(f.id) ? next.delete(f.id) : next.add(f.id)
                            return next
                          })}
                          className="p-1.5 rounded-lg transition"
                          style={{
                            color: showWeather ? 'hsl(210 90% 45%)' : 'var(--fg-subtle)',
                            background: showWeather ? 'hsl(210 90% 96%)' : 'transparent',
                          }}
                          title={showWeather ? 'Ocultar previsão' : 'Mostrar previsão'}
                        >
                          <Cloud size={13} />
                        </button>
                      )}
                      <button onClick={() => openModal(f)} className="p-1.5 rounded-lg transition"
                        style={{ color: 'var(--fg-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-dark)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => handleDelete(f)} className="p-1.5 rounded-lg transition"
                        style={{ color: 'var(--fg-subtle)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'hsl(4 86% 96%)'; e.currentTarget.style.color = 'hsl(4 72% 50%)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-subtle)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Culturas + área */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {culturas.slice(0, 4).map(c => (
                        <span key={c} className="text-base" title={c}>{culturaIcon(c)}</span>
                      ))}
                      {culturas.length === 0 && (
                        <span className="text-xs italic" style={{ color: 'var(--fg-subtle)' }}>Sem talhões</span>
                      )}
                    </div>
                    {(f.area_total || totalArea > 0) && (
                      <span className="text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>
                        {(f.area_total || totalArea).toLocaleString('pt-BR')} ha
                      </span>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <StatCard value={talhoesF.length} label="Talhões" icon={<Leaf size={10} />} />
                    <StatCard value={comPlantio} label="Plantados" icon={<CheckCircle size={10} />} color={comPlantio > 0 ? 'hsl(160 84% 22%)' : undefined} />
                    <StatCard
                      value={atrasadas + hoje}
                      label={atrasadas > 0 ? 'Atrasadas' : hoje > 0 ? 'Hoje' : 'Próximas'}
                      icon={<AlertTriangle size={10} />}
                      color={atrasadas > 0 ? 'hsl(4 72% 45%)' : hoje > 0 ? 'hsl(210 100% 45%)' : undefined}
                      bg={atrasadas > 0 ? 'hsl(4 80% 97%)' : hoje > 0 ? 'hsl(210 100% 97%)' : undefined}
                    />
                  </div>

                  {/* Progresso de semeadura */}
                  {pctSemeado > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>Semeadura</span>
                        {isTotalmenteSemeado ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: 'hsl(160 84% 22%)', background: 'var(--verde-50)' }}>
                            ✓ 100% plantado
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold" style={{ color: 'hsl(160 84% 22%)' }}>
                            {pctSemeado}% semeado
                          </span>
                        )}
                      </div>
                      <div className="rounded-full overflow-hidden h-1.5" style={{ background: 'var(--bg-dark)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pctSemeado}%`,
                            background: isTotalmenteSemeado
                              ? 'hsl(160 84% 30%)'
                              : 'hsl(160 70% 42%)',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Linha de status resumido */}
                  {(proximas > 0 || atrasadas > 0 || hoje > 0) && (
                    <div className="flex gap-2 flex-wrap">
                      {atrasadas > 0 && <Pill label={`${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}`} color="hsl(4 72% 45%)" bg="hsl(4 80% 97%)" />}
                      {hoje > 0 && <Pill label={`${hoje} hoje`} color="hsl(210 100% 40%)" bg="hsl(210 100% 96%)" />}
                      {proximas > 0 && <Pill label={`${proximas} próx.`} color="hsl(32 95% 40%)" bg="hsl(45 100% 93%)" />}
                    </div>
                  )}

                  {/* Previsão do tempo (expansível) */}
                  {showWeather && (
                    <div className="animate-enter">
                      <WeatherWidget
                        latitude={f.latitude}
                        longitude={f.longitude}
                        localizacao={f.localizacao?.split(' - ')[0] || f.localizacao}
                        compact
                      />
                    </div>
                  )}
                </div>

                <Link
                  href={`/fazendas/${f.id}`}
                  className="flex items-center justify-between px-5 py-3 text-sm font-semibold transition"
                  style={{ borderTop: '1px solid var(--borda)', color: 'hsl(160 84% 22%)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--verde-50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  Ver talhões e detalhes <ChevronRight size={14} />
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Fazenda' : 'Nova Fazenda'}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button onClick={handleSave} loading={loading} className="flex-1">{editando ? 'Salvar' : 'Criar'}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Nome da fazenda" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Fazenda Santa Rita" required />
          <Input label="Nome do produtor" value={form.nome_produtor} onChange={e => setForm(f => ({ ...f, nome_produtor: e.target.value }))} placeholder="Ex: João da Silva" />
          {/* Estado */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[--fg-muted] uppercase tracking-wide">Estado</label>
            <div className="relative">
              <select
                value={form.estado}
                onChange={e => {
                  const uf = e.target.value
                  setForm(f => ({ ...f, estado: uf, cidade: '' }))
                }}
                className="h-10 w-full rounded-xl border text-sm text-[--fg] transition-all duration-150 appearance-none pr-8 pl-3 focus:outline-none focus:ring-2 focus:ring-[--primary]/30 focus:border-[--primary] border-[--borda] hover:border-[--fg-subtle]/50"
                style={{ background: 'var(--input-bg)' }}
              >
                <option value="">Selecione o estado</option>
                {ESTADOS_BR.map(e => (
                  <option key={e.uf} value={e.uf}>{e.uf} — {e.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[--fg-subtle] pointer-events-none" />
            </div>
          </div>

          {/* Cidade — input de texto livre */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[--fg-muted] uppercase tracking-wide">Cidade</label>
            <input
              type="text"
              value={form.cidade}
              onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))}
              placeholder="Ex: Confresa, Sinop, Sorriso..."
              className="h-10 w-full rounded-xl border text-sm transition-all duration-150 pl-3 pr-3 focus:outline-none focus:ring-2 focus:ring-[--primary]/30 focus:border-[--primary] border-[--borda] hover:border-[--fg-subtle]/50"
              style={{ background: 'var(--input-bg)', color: 'var(--fg)' }}
            />
          </div>
          <Input label="Área total (hectares)" type="number" value={form.area_total} onChange={e => setForm(f => ({ ...f, area_total: e.target.value }))} placeholder="Ex: 500" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Latitude (opcional)" type="number" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="Ex: -10.9333" />
            <Input label="Longitude (opcional)" type="number" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="Ex: -52.3522" />
          </div>
          <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
            Latitude/longitude permite previsão do tempo precisa para a propriedade.
          </p>
        </div>
      </Modal>
    </div>
  )
}

function StatCard({ value, label, icon, color, bg }: { value: number; label: string; icon: React.ReactNode; color?: string; bg?: string }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: bg || 'var(--bg)' }}>
      <div className="text-lg font-bold" style={{ color: color || 'var(--fg)' }}>{value}</div>
      <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: color || 'var(--fg-muted)' }}>
        {icon}{label}
      </div>
    </div>
  )
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
      {label}
    </span>
  )
}
