'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MonitoramentoPraga, Talhao, CulturaType } from '@/types'
import { worstSeveridade, SEVERIDADE_ORDER } from '@/components/ui/severidade-badge'
import type { SeveridadeMonitoramento } from '@/types'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'

type GroupMode = 'talhao' | 'agente' | 'severidade'

interface TalhaoMonitoramento {
  talhao: Talhao
  registros: MonitoramentoPraga[]
}

interface MonitoramentoHeatmapProps {
  registros: MonitoramentoPraga[]
  talhoes: Talhao[]
}

const SEV_BG: Record<SeveridadeMonitoramento, string> = {
  nenhum:   'var(--bg)',
  leve:     'hsl(142 72% 29% / 0.10)',
  moderado: 'hsl(38 90% 50% / 0.12)',
  severo:   'hsl(25 90% 50% / 0.14)',
  critico:  'hsl(0 72% 51% / 0.14)',
}

const SEV_BORDER: Record<SeveridadeMonitoramento, string> = {
  nenhum:   'var(--borda)',
  leve:     'hsl(142 72% 29% / 0.30)',
  moderado: 'hsl(38 90% 50% / 0.35)',
  severo:   'hsl(25 90% 50% / 0.40)',
  critico:  'hsl(0 72% 51% / 0.40)',
}

const SEV_TEXT: Record<SeveridadeMonitoramento, string> = {
  nenhum:   'var(--fg-subtle)',
  leve:     'hsl(142 72% 29%)',
  moderado: 'hsl(38 90% 40%)',
  severo:   'hsl(25 90% 40%)',
  critico:  'hsl(0 72% 51%)',
}

export function MonitoramentoHeatmap({ registros, talhoes }: MonitoramentoHeatmapProps) {
  const router = useRouter()
  const [groupMode, setGroupMode] = useState<GroupMode>('talhao')

  const talhaoData: TalhaoMonitoramento[] = useMemo(() => {
    return talhoes.map(t => ({
      talhao: t,
      registros: registros.filter(r => r.talhao_id === t.id),
    }))
  }, [talhoes, registros])

  // ── Group by agente ──────────────────────────────────────────────────────────
  const byAgente = useMemo(() => {
    const map = new Map<string, { key: string; label: string; tipo: 'praga' | 'doenca'; cultura: CulturaType; talhoes: { talhao: Talhao; severidade: SeveridadeMonitoramento }[] }>()
    for (const r of registros) {
      const talhao = talhoes.find(t => t.id === r.talhao_id)
      if (!talhao) continue
      const label = getAgenteLabel(talhao.cultura as CulturaType, r.tipo === 'praga' ? 'praga' : 'doenca', r.agente)
      if (!map.has(r.agente)) {
        map.set(r.agente, { key: r.agente, label, tipo: r.tipo === 'praga' ? 'praga' : 'doenca', cultura: talhao.cultura as CulturaType, talhoes: [] })
      }
      const entry = map.get(r.agente)!
      const existing = entry.talhoes.find(x => x.talhao.id === talhao.id)
      if (!existing) {
        const all = registros.filter(x => x.talhao_id === talhao.id && x.agente === r.agente)
        const worst = worstSeveridade(all.map(x => x.severidade))
        entry.talhoes.push({ talhao, severidade: worst })
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const wa = worstSeveridade(a.talhoes.map(x => x.severidade))
      const wb = worstSeveridade(b.talhoes.map(x => x.severidade))
      return SEVERIDADE_ORDER.indexOf(wb) - SEVERIDADE_ORDER.indexOf(wa)
    })
  }, [registros, talhoes])

  // ── Group by severidade ──────────────────────────────────────────────────────
  const bySeveridade = useMemo(() => {
    const grouped: Record<SeveridadeMonitoramento, TalhaoMonitoramento[]> = {
      critico: [], severo: [], moderado: [], leve: [], nenhum: [],
    }
    for (const td of talhaoData) {
      const worst = worstSeveridade(td.registros.map(r => r.severidade))
      grouped[worst].push(td)
    }
    return grouped
  }, [talhaoData])

  const SECS: SeveridadeMonitoramento[] = ['critico', 'severo', 'moderado', 'leve', 'nenhum']
  const SEV_LABELS: Record<SeveridadeMonitoramento, string> = {
    critico: '🔴 Crítico', severo: '🟠 Severo', moderado: '🟡 Moderado', leve: '🟢 Leve', nenhum: '⬜ Nenhum',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Group mode toggle */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['talhao', 'agente', 'severidade'] as GroupMode[]).map(m => (
          <button key={m} onClick={() => setGroupMode(m)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: groupMode === m ? '1.5px solid hsl(160 84% 22%)' : '1.5px solid var(--borda)',
            background: groupMode === m ? 'hsl(160 84% 22% / 0.10)' : 'var(--bg)',
            color: groupMode === m ? 'hsl(160 84% 22%)' : 'var(--fg-subtle)',
          }}>
            {m === 'talhao' ? 'Por Talhão' : m === 'agente' ? 'Por Agente' : 'Por Severidade'}
          </button>
        ))}
      </div>

      {/* ── Por talhão (heatmap grid) ── */}
      {groupMode === 'talhao' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
          {talhaoData.map(({ talhao, registros: regs }) => {
            const worst = worstSeveridade(regs.map(r => r.severidade))
            const topAgente = regs.length > 0 ? regs.sort((a, b) => SEVERIDADE_ORDER.indexOf(b.severidade) - SEVERIDADE_ORDER.indexOf(a.severidade))[0] : null
            return (
              <button
                key={talhao.id}
                onClick={() => router.push(`/talhoes/${talhao.id}?tab=monitoramento`)}
                style={{
                  textAlign: 'left', cursor: 'pointer',
                  background: SEV_BG[worst],
                  border: `1.5px solid ${SEV_BORDER[worst]}`,
                  borderRadius: 10, padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: SEV_TEXT[worst] }}>{talhao.nome}</div>
                {topAgente && (
                  <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                    {getAgenteLabel(talhao.cultura as CulturaType, topAgente.tipo === 'praga' ? 'praga' : 'doenca', topAgente.agente)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{regs.length} registro{regs.length !== 1 ? 's' : ''}</div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Por agente ── */}
      {groupMode === 'agente' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {byAgente.length === 0 && (
            <div style={{ color: 'var(--fg-subtle)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Nenhum registro</div>
          )}
          {byAgente.map(entry => (
            <div key={entry.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--borda)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', marginBottom: 6 }}>
                {entry.label} <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 400 }}>({entry.tipo === 'praga' ? 'Praga' : 'Doença'})</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {entry.talhoes.map(({ talhao, severidade }) => (
                  <button
                    key={talhao.id}
                    onClick={() => router.push(`/talhoes/${talhao.id}?tab=monitoramento`)}
                    style={{
                      padding: '3px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: SEV_BG[severidade], border: `1.5px solid ${SEV_BORDER[severidade]}`, color: SEV_TEXT[severidade],
                    }}
                  >
                    {talhao.nome}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Por severidade ── */}
      {groupMode === 'severidade' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SECS.map(sev => {
            const items = bySeveridade[sev]
            if (items.length === 0) return null
            return (
              <div key={sev}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-subtle)', marginBottom: 6 }}>{SEV_LABELS[sev]}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
                  {items.map(({ talhao, registros: regs }) => (
                    <button
                      key={talhao.id}
                      onClick={() => router.push(`/talhoes/${talhao.id}?tab=monitoramento`)}
                      style={{
                        textAlign: 'left', cursor: 'pointer', padding: '8px 10px', borderRadius: 8,
                        background: SEV_BG[sev], border: `1.5px solid ${SEV_BORDER[sev]}`, color: SEV_TEXT[sev],
                        fontSize: 12, fontWeight: 600,
                      }}
                    >
                      {talhao.nome} <span style={{ fontWeight: 400, opacity: 0.7 }}>({regs.length})</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
