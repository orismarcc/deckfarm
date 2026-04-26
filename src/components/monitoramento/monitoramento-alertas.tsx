'use client'
import { useMemo } from 'react'
import { subDays, parseISO, isAfter } from 'date-fns'
import { AlertTriangle, TrendingUp, Bug } from 'lucide-react'
import type { MonitoramentoPraga, Talhao, CulturaType } from '@/types'
import { SEVERIDADE_ORDER } from '@/components/ui/severidade-badge'
import { getAgenteLabel } from '@/lib/monitoramento/catalogo'

interface AlertaInfo {
  type: 'surto' | 'aumento'
  talhao: Talhao
  agenteLabel: string
  message: string
}

interface MonitoramentoAlertasProps {
  registros: MonitoramentoPraga[]
  talhoes: Talhao[]
}

export function MonitoramentoAlertas({ registros, talhoes }: MonitoramentoAlertasProps) {
  const alertas: AlertaInfo[] = useMemo(() => {
    const now = new Date()
    const last7d  = subDays(now, 7)
    const last30d = subDays(now, 30)
    const results: AlertaInfo[] = []

    const talhaoMap = new Map(talhoes.map(t => [t.id, t]))

    // Group registros by talhao + agente
    const groups = new Map<string, MonitoramentoPraga[]>()
    for (const r of registros) {
      const key = `${r.talhao_id}::${r.agente}`
      const arr = groups.get(key) ?? []
      arr.push(r)
      groups.set(key, arr)
    }

    for (const [key, regs] of groups.entries()) {
      const [talhaoId] = key.split('::')
      const talhao = talhaoMap.get(talhaoId)
      if (!talhao) continue

      const sorted = [...regs].sort((a, b) => b.data.localeCompare(a.data))
      const agenteLabel = getAgenteLabel(
        talhao.cultura as CulturaType,
        sorted[0].tipo === 'praga' ? 'praga' : 'doenca',
        sorted[0].agente
      )

      // Surto novo: agente not seen in last 30d, but has a record in last 7d
      const in7d  = sorted.some(r => { try { return isAfter(parseISO(r.data), last7d) } catch { return false } })
      const in30d = sorted.some(r => { try { return isAfter(parseISO(r.data), last30d) } catch { return false } })
      const before30d = sorted.some(r => {
        try { return !isAfter(parseISO(r.data), last30d) } catch { return false }
      })

      if (in7d && !in30d && before30d) {
        results.push({
          type: 'surto',
          talhao,
          agenteLabel,
          message: `Novo surto de ${agenteLabel} no talhão "${talhao.nome}"`,
        })
      }

      // Aumento de severidade: últimos 2 registros mostram crescimento
      if (sorted.length >= 2) {
        const [r0, r1] = sorted
        if (SEVERIDADE_ORDER.indexOf(r0.severidade) > SEVERIDADE_ORDER.indexOf(r1.severidade)) {
          results.push({
            type: 'aumento',
            talhao,
            agenteLabel,
            message: `${agenteLabel} com severidade crescente no talhão "${talhao.nome}"`,
          })
        }
      }
    }

    return results
  }, [registros, talhoes])

  if (alertas.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alertas.map((alerta, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 14px',
          borderRadius: 10,
          background: alerta.type === 'surto' ? 'hsl(0 72% 51% / 0.08)' : 'hsl(38 90% 50% / 0.10)',
          border: `1.5px solid ${alerta.type === 'surto' ? 'hsl(0 72% 51% / 0.25)' : 'hsl(38 90% 50% / 0.30)'}`,
        }}>
          {alerta.type === 'surto'
            ? <Bug size={15} style={{ flexShrink: 0, marginTop: 1, color: 'hsl(0 72% 51%)' }} />
            : <TrendingUp size={15} style={{ flexShrink: 0, marginTop: 1, color: 'hsl(38 90% 40%)' }} />
          }
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', marginBottom: 2 }}>
              {alerta.type === 'surto' ? '🔴 Novo surto detectado' : '📈 Aumento de severidade'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>{alerta.message}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Inline alert for talhão-level growing incidence */
interface TendenciaAlertaProps {
  registros: MonitoramentoPraga[]
  cultura: CulturaType
}

export function TendenciaAlerta({ registros, cultura }: TendenciaAlertaProps) {
  const tendencias = useMemo(() => {
    // Group by agente, find if last 3 sorted by date are all increasing
    const groups = new Map<string, MonitoramentoPraga[]>()
    for (const r of registros) {
      const arr = groups.get(r.agente) ?? []
      arr.push(r)
      groups.set(r.agente, arr)
    }

    const results: { agenteLabel: string; tipo: 'praga' | 'doenca' }[] = []

    for (const [agente, regs] of groups.entries()) {
      const sorted = [...regs].sort((a, b) => b.data.localeCompare(a.data))
      if (sorted.length < 3) continue
      const [r0, r1, r2] = sorted
      if (
        SEVERIDADE_ORDER.indexOf(r0.severidade) > SEVERIDADE_ORDER.indexOf(r1.severidade) &&
        SEVERIDADE_ORDER.indexOf(r1.severidade) > SEVERIDADE_ORDER.indexOf(r2.severidade)
      ) {
        const tipo = r0.tipo === 'praga' ? 'praga' : 'doenca'
        results.push({
          agenteLabel: getAgenteLabel(cultura, tipo, agente),
          tipo,
        })
      }
    }
    return results
  }, [registros, cultura])

  if (tendencias.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {tendencias.map((t, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 9,
          background: 'hsl(38 90% 50% / 0.10)',
          border: '1.5px solid hsl(38 90% 50% / 0.30)',
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, color: 'hsl(38 90% 40%)' }} />
          <span style={{ fontSize: 12, color: 'var(--fg)' }}>
            <strong>{t.agenteLabel}</strong> com incidência crescente — avalie {t.tipo === 'doenca' ? 'fungicida' : 'inseticida'} para este talhão
          </span>
        </div>
      ))}
    </div>
  )
}
