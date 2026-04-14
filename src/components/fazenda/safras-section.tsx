'use client'
import { useState, useEffect } from 'react'
import { getDB } from '@/lib/db'
import type { Safra, CulturaType, SafraStatus } from '@/types'
import { gerarId, culturaLabel } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, Wheat, ChevronDown, ChevronUp, Calendar } from 'lucide-react'

const culturas: { value: CulturaType; label: string }[] = [
  { value: 'soja', label: 'Soja' },
  { value: 'milho', label: 'Milho' },
  { value: 'milho_safrinha', label: 'Milho Safrinha' },
  { value: 'gergelim', label: 'Gergelim' },
  { value: 'feijao', label: 'Feijão' },
  { value: 'algodao', label: 'Algodão' },
]

const statusConfig: Record<SafraStatus, { label: string; color: string; bg: string }> = {
  planejada:    { label: 'Planejada',     color: 'hsl(215 60% 40%)', bg: 'hsl(215 60% 95%)' },
  em_andamento: { label: 'Em andamento',  color: 'hsl(160 84% 22%)', bg: 'hsl(160 84% 22% / 0.10)' },
  finalizada:   { label: 'Finalizada',    color: 'hsl(215 20% 45%)', bg: 'hsl(215 20% 94%)' },
}

function gerarNomeSafra(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1 // 1-12
  if (m >= 6) return `${y}/${String(y + 1).slice(-2)}`
  return `${y - 1}/${String(y).slice(-2)}`
}

function calcProgress(safra: Safra): number {
  if (!safra.data_plantio || !safra.data_colheita_prevista) return 0
  const start = new Date(safra.data_plantio).getTime()
  const end = new Date(safra.data_colheita_prevista).getTime()
  const now = Date.now()
  if (now <= start) return 0
  if (now >= end) return 100
  return Math.round(((now - start) / (end - start)) * 100)
}

interface SafraFormState {
  nome: string
  cultura: CulturaType
  area_plantada: string
  data_plantio: string
  data_colheita_prevista: string
  status: SafraStatus
  observacoes: string
}

const emptyForm = (): SafraFormState => ({
  nome: gerarNomeSafra(),
  cultura: 'soja',
  area_plantada: '',
  data_plantio: '',
  data_colheita_prevista: '',
  status: 'planejada',
  observacoes: '',
})

export function SafrasSection({ fazendaId }: { fazendaId: string }) {
  const [safras, setSafras] = useState<Safra[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<SafraFormState>(emptyForm())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!fazendaId) return
    getDB().safras.where('fazenda_id').equals(fazendaId).reverse().sortBy('ano_inicio').then(setSafras)
  }, [fazendaId])

  async function salvar() {
    setLoading(true)
    try {
      const [anoInicioStr, anoFimStr] = form.nome.split('/')
      const ano_inicio = parseInt(anoInicioStr) || new Date().getFullYear()
      const ano_fim = anoFimStr ? parseInt(`20${anoFimStr}`) : ano_inicio + 1
      const now = new Date().toISOString()
      const nova: Safra = {
        id: gerarId(),
        nome: form.nome,
        ano_inicio,
        ano_fim,
        fazenda_id: fazendaId,
        cultura: form.cultura,
        area_plantada: form.area_plantada ? Number(form.area_plantada) : undefined,
        data_plantio: form.data_plantio || undefined,
        data_colheita_prevista: form.data_colheita_prevista || undefined,
        status: form.status,
        observacoes: form.observacoes || undefined,
        createdAt: now,
        updatedAt: now,
        _syncStatus: 'pending',
      }
      await getDB().safras.add(nova)
      setSafras(prev => [nova, ...prev].sort((a, b) => b.ano_inicio - a.ano_inicio))
      setModalOpen(false)
      setForm(emptyForm())
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>Safras</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            {safras.length} safra{safras.length !== 1 ? 's' : ''} registrada{safras.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm()); setModalOpen(true) }}
          style={{ background: 'hsl(160 84% 22%)', color: 'white', boxShadow: '0 2px 8px rgba(10,91,50,0.25)' }}>
          <Plus size={13} /> Nova Safra
        </Button>
      </div>

      {safras.length === 0 && (
        <div className="text-center py-10 rounded-xl" style={{ background: 'var(--bg)', border: '1px dashed var(--borda)' }}>
          <Wheat size={28} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--fg-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--fg-subtle)' }}>Nenhuma safra cadastrada</p>
          <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)', opacity: 0.7 }}>
            Registre safras para acompanhar o histórico por ano-agrícola
          </p>
        </div>
      )}

      <div className="space-y-2">
        {safras.map(s => {
          const sc = statusConfig[s.status]
          const progress = calcProgress(s)
          const isOpen = expanded === s.id
          return (
            <div key={s.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--borda)', background: 'var(--bg-card)' }}>
              <button
                className="w-full flex items-center gap-3 p-4 text-left transition-colors"
                onClick={() => setExpanded(isOpen ? null : s.id)}
                style={{ background: isOpen ? 'var(--bg)' : 'transparent' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                  style={{ background: 'var(--verde-50)' }}>
                  🌾
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>Safra {s.nome}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: sc.color, background: sc.bg }}>
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                    {culturaLabel(s.cultura)}{s.area_plantada ? ` · ${s.area_plantada} ha` : ''}
                  </p>
                </div>
                {isOpen ? <ChevronUp size={16} style={{ color: 'var(--fg-subtle)' }} /> : <ChevronDown size={16} style={{ color: 'var(--fg-subtle)' }} />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--borda)' }}>
                  {/* Progress bar */}
                  {s.status === 'em_andamento' && s.data_plantio && s.data_colheita_prevista && (
                    <div className="pt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>Progresso da safra</span>
                        <span className="text-xs font-semibold" style={{ color: 'hsl(160 84% 22%)' }}>{progress}%</span>
                      </div>
                      <div className="h-2 rounded-full w-full" style={{ background: 'var(--borda)' }}>
                        <div className="h-2 rounded-full transition-all" style={{ width: `${progress}%`, background: 'hsl(160 84% 22%)' }} />
                      </div>
                    </div>
                  )}

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {s.data_plantio && (
                      <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)' }}>
                        <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--fg-subtle)' }}>Plantio</div>
                        <div className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--fg)' }}>
                          <Calendar size={11} />
                          {new Date(s.data_plantio + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    )}
                    {s.data_colheita_prevista && (
                      <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)' }}>
                        <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--fg-subtle)' }}>Colheita prev.</div>
                        <div className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--fg)' }}>
                          <Calendar size={11} />
                          {new Date(s.data_colheita_prevista + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    )}
                    {s.area_plantada && (
                      <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)' }}>
                        <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--fg-subtle)' }}>Área</div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{s.area_plantada} ha</div>
                      </div>
                    )}
                    {s.produtividade_media && (
                      <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)' }}>
                        <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--fg-subtle)' }}>Produtividade</div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{s.produtividade_media} sc/ha</div>
                      </div>
                    )}
                  </div>

                  {s.observacoes && (
                    <div className="rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--bg)', color: 'var(--fg-muted)' }}>
                      {s.observacoes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova Safra"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button onClick={salvar} loading={loading} className="flex-1"
              style={{ background: 'hsl(160 84% 22%)', color: 'white' }}>
              Registrar safra
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Identificação da safra"
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            placeholder="Ex: 2025/26"
          />
          <Select
            label="Cultura principal"
            value={form.cultura}
            onChange={e => setForm(f => ({ ...f, cultura: e.target.value as CulturaType }))}
            options={culturas}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Área plantada (ha)"
              type="number"
              value={form.area_plantada}
              onChange={e => setForm(f => ({ ...f, area_plantada: e.target.value }))}
              placeholder="Ex: 350"
            />
            <Select
              label="Status"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as SafraStatus }))}
              options={[
                { value: 'planejada', label: 'Planejada' },
                { value: 'em_andamento', label: 'Em andamento' },
                { value: 'finalizada', label: 'Finalizada' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data de plantio"
              type="date"
              value={form.data_plantio}
              onChange={e => setForm(f => ({ ...f, data_plantio: e.target.value }))}
            />
            <Input
              label="Colheita prevista"
              type="date"
              value={form.data_colheita_prevista}
              onChange={e => setForm(f => ({ ...f, data_colheita_prevista: e.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              placeholder="Notas sobre a safra, variedade utilizada, condições..."
              rows={3}
              className="field-input mt-1 w-full resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
