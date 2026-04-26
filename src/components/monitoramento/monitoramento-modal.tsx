'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Bug, Leaf, X } from 'lucide-react'
import type { MonitoramentoPraga, SeveridadeMonitoramento, TipoAgente, CulturaType } from '@/types'
import { CATALOGO_AGENTES } from '@/lib/monitoramento/catalogo'
import { PhotoPicker } from '@/components/ui/photo-picker'

const TODAY = format(new Date(), 'yyyy-MM-dd')

const SEVERIDADE_OPTIONS: { value: SeveridadeMonitoramento; label: string; color: string; bg: string }[] = [
  { value: 'nenhum',   label: 'Nenhum',   color: '#6b7280', bg: '#f3f4f6' },
  { value: 'leve',     label: 'Leve',     color: '#166534', bg: '#dcfce7' },
  { value: 'moderado', label: 'Moderado', color: '#92400e', bg: '#fef3c7' },
  { value: 'severo',   label: 'Severo',   color: '#9a3412', bg: '#ffedd5' },
  { value: 'critico',  label: 'Crítico',  color: '#991b1b', bg: '#fee2e2' },
]

interface MonitoramentoModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<MonitoramentoPraga, 'id' | 'createdAt' | 'updatedAt' | '_syncStatus'>) => Promise<void>
  editRecord?: MonitoramentoPraga | null
  talhaoId: string
  fazendaId: string
  usuarioId: string
  cultura: CulturaType
}

export function MonitoramentoModal({
  open, onClose, onSave, editRecord,
  talhaoId, fazendaId, usuarioId, cultura,
}: MonitoramentoModalProps) {
  const [tipo,        setTipo]        = useState<TipoAgente>('praga')
  const [agente,      setAgente]      = useState('')
  const [severidade,  setSeveridade]  = useState<SeveridadeMonitoramento>('leve')
  const [data,        setData]        = useState(TODAY)
  const [areaAfetada, setAreaAfetada] = useState<number>(0)
  const [fotos,       setFotos]       = useState<string[]>([])
  const [observacoes, setObservacoes] = useState('')
  const [saving,      setSaving]      = useState(false)

  const catalogoTipo = tipo === 'praga'
    ? (CATALOGO_AGENTES[cultura]?.pragas ?? [])
    : (CATALOGO_AGENTES[cultura]?.doencas ?? [])

  // Reset form when opening / switching to a different record
  useEffect(() => {
    if (!open) return
    if (editRecord) {
      setTipo(editRecord.tipo)
      setAgente(editRecord.agente)
      setSeveridade(editRecord.severidade)
      setData(editRecord.data)
      setAreaAfetada(editRecord.area_afetada ?? 0)
      setFotos(editRecord.fotos ?? [])
      setObservacoes(editRecord.observacoes ?? '')
    } else {
      setTipo('praga')
      setAgente('')
      setSeveridade('leve')
      setData(TODAY)
      setAreaAfetada(0)
      setFotos([])
      setObservacoes('')
    }
  }, [open, editRecord])

  // When tipo changes, reset agente
  function handleTipoChange(t: TipoAgente) {
    setTipo(t)
    setAgente('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agente) return
    setSaving(true)
    try {
      await onSave({
        talhao_id: talhaoId,
        fazenda_id: fazendaId,
        usuario_id: usuarioId,
        tipo,
        agente,
        severidade,
        data,
        area_afetada: areaAfetada > 0 ? areaAfetada : undefined,
        fotos: fotos.length > 0 ? fotos : undefined,
        observacoes: observacoes.trim() || undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />

      {/* Modal */}
      <form onSubmit={handleSubmit} style={{
        position: 'relative', zIndex: 1,
        background: 'var(--bg-card)',
        border: '1px solid var(--borda)',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 480,
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>
            {editRecord ? 'Editar Monitoramento' : 'Novo Monitoramento'}
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* 1. Tipo toggle */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 6 }}>Tipo</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {([['praga', 'Praga', Bug], ['doenca', 'Doença', Leaf]] as const).map(([val, lbl, Icon]) => (
              <button
                key={val}
                type="button"
                onClick={() => handleTipoChange(val as TipoAgente)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px 0', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: tipo === val ? '2px solid hsl(160 84% 22%)' : '1.5px solid var(--borda)',
                  background: tipo === val ? 'hsl(160 84% 22% / 0.10)' : 'var(--bg)',
                  color: tipo === val ? 'hsl(160 84% 22%)' : 'var(--fg-subtle)',
                }}
              >
                <Icon size={13} /> {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Agente */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 6 }}>
            {tipo === 'praga' ? 'Praga' : 'Doença'}
          </label>
          <select
            required
            value={agente}
            onChange={e => setAgente(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--borda)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13 }}
          >
            <option value="">Selecionar...</option>
            {catalogoTipo.map(a => (
              <option key={a.key} value={a.key}>{a.label}</option>
            ))}
          </select>
        </div>

        {/* 3. Severidade */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 6 }}>Severidade</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SEVERIDADE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSeveridade(opt.value)}
                style={{
                  flex: '1 1 auto', padding: '6px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: severidade === opt.value ? `2px solid ${opt.color}` : '1.5px solid var(--borda)',
                  background: severidade === opt.value ? opt.bg : 'var(--bg)',
                  color: severidade === opt.value ? opt.color : 'var(--fg-subtle)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Data */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 6 }}>Data</label>
          <input
            type="date"
            required
            value={data}
            onChange={e => setData(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--borda)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13 }}
          />
        </div>

        {/* 5. Área afetada */}
        <div>
          <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 6 }}>
            <span>Área afetada</span>
            <span style={{ color: 'var(--fg)' }}>{areaAfetada}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={areaAfetada}
            onChange={e => setAreaAfetada(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'hsl(160 84% 22%)' }}
          />
        </div>

        {/* 6. Fotos */}
        <PhotoPicker photos={fotos} onChange={setFotos} maxPhotos={4} label="Fotos" />

        {/* 7. Observações */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-subtle)', marginBottom: 6 }}>Observações</label>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            rows={3}
            placeholder="Notas adicionais..."
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--borda)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid var(--borda)', background: 'var(--bg)', color: 'var(--fg-subtle)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !agente}
            style={{ padding: '8px 20px', borderRadius: 9, border: 'none', background: 'hsl(160 84% 22%)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: !agente ? 0.5 : 1 }}
          >
            {saving ? 'Salvando...' : editRecord ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </form>
    </div>
  )
}
