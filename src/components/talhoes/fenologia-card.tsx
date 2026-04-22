'use client'
/**
 * FenologiaCard — Estágio fenológico esperado da cultura
 *
 * Mostra onde a cultura DEVERIA estar hoje (baseado em data_plantio + cultura),
 * numa linha do tempo visual com todos os estágios. O usuário pode marcar o
 * estágio que está OBSERVANDO no campo para comparar com o esperado.
 */
import { useState, useMemo } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import type { CulturaType } from '@/types'
import { Leaf, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react'

// ── Definição fenológica por cultura ─────────────────────────────────────────
interface Fase {
  id: string
  label: string        // nome curto (ex: "VE", "R1")
  desc: string         // descrição (ex: "Emergência")
  detalhe: string      // o que observar no campo
  diaInicio: number    // dias após plantio
  diaFim: number
  icon: string
  color: string
}

const FENOLOGIA: Record<CulturaType, { ciclo: number; fases: Fase[] }> = {
  soja: {
    ciclo: 110,
    fases: [
      { id: 'VE',  label: 'VE',  desc: 'Emergência',              detalhe: 'Cotiledões acima do solo, hipocótilo visível.',                         diaInicio: 0,   diaFim: 7,   icon: '🌱', color: '#86efac' },
      { id: 'VC',  label: 'VC',  desc: 'Cotilédones abertos',     detalhe: 'Folhas cotiledonares abertas e expandidas.',                             diaInicio: 7,   diaFim: 14,  icon: '🌿', color: '#4ade80' },
      { id: 'V2',  label: 'V2',  desc: 'Estágio vegetativo V2',   detalhe: '2ª folha trifoliolada completamente expandida.',                         diaInicio: 14,  diaFim: 25,  icon: '🌿', color: '#22c55e' },
      { id: 'V4',  label: 'V4',  desc: 'Estágio vegetativo V4',   detalhe: '4ª folha trifoliolada. Planta robusta em crescimento.',                  diaInicio: 25,  diaFim: 38,  icon: '🌿', color: '#16a34a' },
      { id: 'R1',  label: 'R1',  desc: 'Início do florescimento', detalhe: 'Primeiras flores abertas em qualquer nó. Cor branca ou roxa.',            diaInicio: 38,  diaFim: 50,  icon: '🌸', color: '#f472b6' },
      { id: 'R2',  label: 'R2',  desc: 'Florescimento pleno',     detalhe: 'Flores em 50% ou mais dos nós superiores.',                              diaInicio: 50,  diaFim: 60,  icon: '🌸', color: '#ec4899' },
      { id: 'R3',  label: 'R3',  desc: 'Início da frutificação',  detalhe: 'Primeiras vagens com 5mm nos 4 nós superiores.',                         diaInicio: 60,  diaFim: 70,  icon: '🫘', color: '#fb923c' },
      { id: 'R4',  label: 'R4',  desc: 'Frutificação plena',      detalhe: 'Vagens cheias com 2cm nos 4 nós superiores.',                            diaInicio: 70,  diaFim: 82,  icon: '🫘', color: '#f97316' },
      { id: 'R5',  label: 'R5',  desc: 'Enchimento de grãos',     detalhe: 'Sementes visíveis em vagens dos 4 nós superiores.',                      diaInicio: 82,  diaFim: 95,  icon: '⚪', color: '#facc15' },
      { id: 'R6',  label: 'R6',  desc: 'Grão cheio',              detalhe: 'Vagens verdes atingiram tamanho máximo, grãos verdes.',                   diaInicio: 95,  diaFim: 105, icon: '🟡', color: '#eab308' },
      { id: 'R7',  label: 'R7',  desc: 'Início da maturação',     detalhe: 'Uma vagem normal com coloração de maturidade (amarela/marrom).',          diaInicio: 105, diaFim: 110, icon: '🟤', color: '#a16207' },
      { id: 'R8',  label: 'R8',  desc: 'Maturação / Colheita',    detalhe: '95% das vagens com coloração madura. Umidade ≤ 15%. Pronto colher.',      diaInicio: 110, diaFim: 120, icon: '🚜', color: '#92400e' },
    ],
  },
  milho: {
    ciclo: 120,
    fases: [
      { id: 'VE',  label: 'VE',  desc: 'Emergência',              detalhe: 'Coleóptilo visível acima do solo.',                                      diaInicio: 0,   diaFim: 8,   icon: '🌱', color: '#86efac' },
      { id: 'V3',  label: 'V3',  desc: 'Vegetativo inicial',      detalhe: '3 folhas com colar visível. Crescimento lento.',                          diaInicio: 8,   diaFim: 25,  icon: '🌿', color: '#4ade80' },
      { id: 'V6',  label: 'V6',  desc: 'Vegetativo acelerado',    detalhe: '6 folhas expandidas. Raiz nodal ativa. Ponto de crescimento abaixo do solo.',diaInicio: 25,  diaFim: 42,  icon: '🌿', color: '#22c55e' },
      { id: 'V10', label: 'V10', desc: 'Pré-pendoamento',         detalhe: '10 folhas. Pendão diferenciado internamente. Crescimento máximo.',         diaInicio: 42,  diaFim: 58,  icon: '🌿', color: '#16a34a' },
      { id: 'VT',  label: 'VT',  desc: 'Pendoamento',             detalhe: 'Pendão completamente exposto, liberando pólen.',                          diaInicio: 58,  diaFim: 68,  icon: '🌾', color: '#a3e635' },
      { id: 'R1',  label: 'R1',  desc: 'Espigamento / Silkagem',  detalhe: 'Estilos-estigmas visíveis. Polinização em curso (2–4 dias).',             diaInicio: 68,  diaFim: 75,  icon: '🌽', color: '#fbbf24' },
      { id: 'R2',  label: 'R2',  desc: 'Bolha d\'água',           detalhe: 'Grãos brancos translúcidos, líquido claro. 250 grãos/espiga.',            diaInicio: 75,  diaFim: 85,  icon: '🌽', color: '#f59e0b' },
      { id: 'R3',  label: 'R3',  desc: 'Pastoso',                 detalhe: 'Grãos com consistência pastosa branca. Linha do leite ausente.',          diaInicio: 85,  diaFim: 95,  icon: '🌽', color: '#f97316' },
      { id: 'R4',  label: 'R4',  desc: 'Farináceo',               detalhe: 'Linha do leite a 50%. Grão duro na metade superior.',                    diaInicio: 95,  diaFim: 108, icon: '🌽', color: '#ea580c' },
      { id: 'R5',  label: 'R5',  desc: 'Maturação fisiológica',   detalhe: 'Camada negra formada. Máximo acúmulo de MS. Umidade ~35%.',              diaInicio: 108, diaFim: 120, icon: '🚜', color: '#92400e' },
    ],
  },
  milho_safrinha: {
    ciclo: 115,
    fases: [
      { id: 'VE',  label: 'VE',  desc: 'Emergência',              detalhe: 'Coleóptilo visível. Condições mais frias que no verão.',                  diaInicio: 0,   diaFim: 10,  icon: '🌱', color: '#86efac' },
      { id: 'V3',  label: 'V3',  desc: 'Vegetativo inicial',      detalhe: '3 folhas. Crescimento mais lento pelo frio.',                             diaInicio: 10,  diaFim: 28,  icon: '🌿', color: '#4ade80' },
      { id: 'V6',  label: 'V6',  desc: 'Vegetativo acelerado',    detalhe: '6 folhas. Monitorar geadas e deficiência hídrica.',                       diaInicio: 28,  diaFim: 48,  icon: '🌿', color: '#22c55e' },
      { id: 'V10', label: 'V10', desc: 'Pré-pendoamento',         detalhe: '10 folhas. Pendão interno diferenciado.',                                 diaInicio: 48,  diaFim: 62,  icon: '🌿', color: '#16a34a' },
      { id: 'VT',  label: 'VT',  desc: 'Pendoamento',             detalhe: 'Pólen liberado. Risco de frio prejudicar polinização.',                   diaInicio: 62,  diaFim: 72,  icon: '🌾', color: '#a3e635' },
      { id: 'R1',  label: 'R1',  desc: 'Espigamento',             detalhe: 'Estilos-estigmas visíveis. Polinização crítica.',                         diaInicio: 72,  diaFim: 80,  icon: '🌽', color: '#fbbf24' },
      { id: 'R3',  label: 'R3',  desc: 'Pastoso / Farináceo',     detalhe: 'Grãos em formação. Frio intenso pode causar chochamento.',                diaInicio: 80,  diaFim: 100, icon: '🌽', color: '#f97316' },
      { id: 'R5',  label: 'R5',  desc: 'Maturação fisiológica',   detalhe: 'Camada negra formada. Colheita possível após umidade ≤ 18%.',             diaInicio: 100, diaFim: 115, icon: '🚜', color: '#92400e' },
    ],
  },
  algodao: {
    ciclo: 160,
    fases: [
      { id: 'VE',  label: 'VE',  desc: 'Emergência',              detalhe: 'Hipocótilo emerge. Cotilédones expandidos em 3–5 dias.',                  diaInicio: 0,   diaFim: 7,   icon: '🌱', color: '#86efac' },
      { id: 'V2',  label: 'V2',  desc: 'Vegetativo inicial',      detalhe: '2 folhas verdadeiras expandidas. Crescimento apical ativo.',              diaInicio: 7,   diaFim: 25,  icon: '🌿', color: '#4ade80' },
      { id: 'B1',  label: 'B1',  desc: 'Primeiro botão floral',   detalhe: 'Botão quadrado visível no 1º ramo frutífero. Marco crítico.',             diaInicio: 25,  diaFim: 50,  icon: '🔲', color: '#a78bfa' },
      { id: 'F1',  label: 'F1',  desc: 'Primeira flor',           detalhe: 'Flor branca/creme aberta. Polinização diurna. Cair após 3 dias.',          diaInicio: 50,  diaFim: 70,  icon: '🌸', color: '#c084fc' },
      { id: 'C1',  label: 'C1',  desc: 'Primeiro capulho',        detalhe: 'Maçã jovem em formação (capulho verde). Crescimento em 45–60 dias.',      diaInicio: 70,  diaFim: 100, icon: '🟢', color: '#34d399' },
      { id: 'MA',  label: 'Maçã',desc: 'Maçãs em plena formação', detalhe: 'Maçãs verdes grandes. Defesa contra pragas é crítica.',                   diaInicio: 100, diaFim: 130, icon: '🟡', color: '#fbbf24' },
      { id: 'AB',  label: 'AB',  desc: 'Abertura de capulhos',    detalhe: 'Capulhos abrindo com fibra branca. Iniciar monitoramento para colheita.',  diaInicio: 130, diaFim: 155, icon: '🔶', color: '#fb923c' },
      { id: 'CO',  label: 'Col', desc: 'Colheita',                detalhe: '60–70% de capulhos abertos. Momento ideal para desfolha/colheita.',        diaInicio: 155, diaFim: 170, icon: '🚜', color: '#92400e' },
    ],
  },
  feijao: {
    ciclo: 90,
    fases: [
      { id: 'VE',  label: 'VE',  desc: 'Emergência',              detalhe: 'Cotilédones acima do solo. Arco de emergência visível.',                  diaInicio: 0,   diaFim: 6,   icon: '🌱', color: '#86efac' },
      { id: 'V2',  label: 'V2',  desc: 'Vegetativo',              detalhe: '1ª folha trifoliolada expandida. Nódulos radiculares se formando.',        diaInicio: 6,   diaFim: 20,  icon: '🌿', color: '#22c55e' },
      { id: 'R5',  label: 'R5',  desc: 'Pré-florescimento',       detalhe: 'Botões florais em todos os nós do caule. Clima seco favorece.',            diaInicio: 20,  diaFim: 33,  icon: '🌸', color: '#f9a8d4' },
      { id: 'R6',  label: 'R6',  desc: 'Florescimento',           detalhe: 'Flores abertas. Temp. noturna abaixo de 15 °C afeta fertilização.',        diaInicio: 33,  diaFim: 45,  icon: '🌸', color: '#ec4899' },
      { id: 'R7',  label: 'R7',  desc: 'Formação de vagens',      detalhe: 'Vagens com 2,5 cm. Monitorar pragas como vaquinha e mosca-branca.',       diaInicio: 45,  diaFim: 60,  icon: '🫘', color: '#fb923c' },
      { id: 'R8',  label: 'R8',  desc: 'Enchimento de grãos',     detalhe: 'Grãos enchendo. Umidade controlada evita podridões. 75–80% água.',        diaInicio: 60,  diaFim: 78,  icon: '🫘', color: '#f97316' },
      { id: 'R9',  label: 'R9',  desc: 'Maturação / Colheita',    detalhe: '90% das vagens amareladas/secas. Bater antes da deiscência.',             diaInicio: 78,  diaFim: 95,  icon: '🚜', color: '#92400e' },
    ],
  },
  gergelim: {
    ciclo: 100,
    fases: [
      { id: 'VE',  label: 'VE',  desc: 'Emergência',              detalhe: 'Plântulas com cotilédones abertos. Solo deve estar úmido.',               diaInicio: 0,   diaFim: 7,   icon: '🌱', color: '#86efac' },
      { id: 'V2',  label: 'V2',  desc: 'Vegetativo inicial',      detalhe: '2 pares de folhas. Crescimento em roseta.',                               diaInicio: 7,   diaFim: 22,  icon: '🌿', color: '#4ade80' },
      { id: 'V4',  label: 'V4',  desc: 'Vegetativo pleno',        detalhe: '4+ pares de folhas. Crescimento vertical acelerado.',                     diaInicio: 22,  diaFim: 38,  icon: '🌿', color: '#16a34a' },
      { id: 'R1',  label: 'R1',  desc: 'Início do florescimento', detalhe: 'Primeiras flores brancas/lilás tubulares no 1º internó.',                 diaInicio: 38,  diaFim: 52,  icon: '🌸', color: '#c084fc' },
      { id: 'R2',  label: 'R2',  desc: 'Florescimento pleno',     detalhe: 'Flores em todos os internódios. Abelhas importantes nesta fase.',          diaInicio: 52,  diaFim: 65,  icon: '🌸', color: '#a855f7' },
      { id: 'R3',  label: 'R3',  desc: 'Formação de cápsulas',    detalhe: 'Cápsulas alongadas verdes. Monitorar Laspeyresia (broca da cápsula).',    diaInicio: 65,  diaFim: 82,  icon: '🔵', color: '#38bdf8' },
      { id: 'R4',  label: 'R4',  desc: 'Maturação / Colheita',    detalhe: 'Cápsulas amareladas, deiscência iminente. Colher antes de abrir.',        diaInicio: 82,  diaFim: 105, icon: '🚜', color: '#92400e' },
    ],
  },
}

// ── Utilitários ───────────────────────────────────────────────────────────────
function getFaseAtual(cultura: CulturaType, diasAposPlantio: number): { fase: Fase | null; idx: number; total: number } {
  const dados = FENOLOGIA[cultura]
  if (!dados) return { fase: null, idx: -1, total: 0 }
  const { fases } = dados
  for (let i = 0; i < fases.length; i++) {
    if (diasAposPlantio >= fases[i].diaInicio && diasAposPlantio < fases[i].diaFim) {
      return { fase: fases[i], idx: i, total: fases.length }
    }
  }
  // Além do ciclo
  if (diasAposPlantio >= dados.ciclo) return { fase: fases[fases.length - 1], idx: fases.length - 1, total: fases.length }
  return { fase: fases[0], idx: 0, total: fases.length }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface FenologiaCardProps {
  cultura: CulturaType
  dataPlantio?: string   // ISO date
  talhaoId: string
}

const CULTURA_LABELS: Record<CulturaType, string> = {
  soja: 'Soja', milho: 'Milho', milho_safrinha: 'Milho Safrinha',
  gergelim: 'Gergelim', feijao: 'Feijão', algodao: 'Algodão',
}

export function FenologiaCard({ cultura, dataPlantio, talhaoId }: FenologiaCardProps) {
  const [expanded,       setExpanded]       = useState(false)
  const [observadoIdx,   setObservadoIdx]   = useState<number | null>(null)
  const [showObs,        setShowObs]        = useState(false)

  // Persistir observação por talhão no localStorage
  const LS_KEY = `fenologia-obs-${talhaoId}`
  const [obsIniciado, setObsIniciado] = useState(() => {
    if (typeof window === 'undefined') return false
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return false
    const data = JSON.parse(raw)
    if (typeof data.idx === 'number') { setObservadoIdx(data.idx); return true }
    return false
  })

  const dados = FENOLOGIA[cultura]
  const hoje = new Date()

  const { diasAposPlantio, pct } = useMemo(() => {
    if (!dataPlantio) return { diasAposPlantio: -1, pct: -1 }
    const planted = parseISO(dataPlantio)
    const dias = differenceInDays(hoje, planted)
    const ciclo = dados?.ciclo ?? 120
    return { diasAposPlantio: dias, pct: Math.round((dias / ciclo) * 100) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataPlantio, cultura])

  const { fase: faseEsperada, idx: idxEsperado } = useMemo(
    () => getFaseAtual(cultura, diasAposPlantio),
    [cultura, diasAposPlantio]
  )

  const faseObservada = observadoIdx !== null ? dados?.fases[observadoIdx] : null

  function salvarObservacao(idx: number) {
    setObservadoIdx(idx)
    setObsIniciado(true)
    localStorage.setItem(LS_KEY, JSON.stringify({ idx, data: new Date().toISOString() }))
    setShowObs(false)
  }

  if (!dados) return null

  const plantioLabel = dataPlantio
    ? `Plantado há ${diasAposPlantio} dias`
    : 'Data de plantio não definida'

  const semPlantio = !dataPlantio || diasAposPlantio < 0

  // Comparação: atrasado, adiantado ou no prazo
  let diffLabel = ''
  let diffColor = '#16a34a'
  if (faseObservada && faseEsperada && observadoIdx !== null) {
    const diff = observadoIdx - idxEsperado
    if (diff === 0) { diffLabel = '✅ No estágio esperado'; diffColor = '#16a34a' }
    else if (diff < 0) { diffLabel = `⚠️ ${Math.abs(diff)} estágio${Math.abs(diff) > 1 ? 's' : ''} atrasado em relação ao esperado`; diffColor = '#dc2626' }
    else { diffLabel = `🚀 ${diff} estágio${diff > 1 ? 's' : ''} adiantado em relação ao esperado`; diffColor = '#2563eb' }
  }

  return (
    <div className="card overflow-hidden" style={{ marginBottom: 0 }}>
      {/* ── Cabeçalho ── */}
      <button
        className="w-full text-left"
        onClick={() => setExpanded(v => !v)}
        style={{ padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'hsl(134 60% 30% / 0.1)' }}>
              🌾
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>
                Fenologia — {CULTURA_LABELS[cultura]}
              </p>
              <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                {semPlantio
                  ? 'Defina a data de plantio para ver a fenologia'
                  : faseEsperada
                    ? `Fase esperada hoje: ${faseEsperada.label} — ${faseEsperada.desc}`
                    : plantioLabel
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {faseEsperada && !semPlantio && (
              <span className="text-xs font-bold px-2 py-1 rounded-full"
                style={{ background: `${faseEsperada.color}22`, color: faseEsperada.color, border: `1px solid ${faseEsperada.color}55` }}>
                {faseEsperada.icon} {faseEsperada.label}
              </span>
            )}
            {expanded
              ? <ChevronUp size={16} style={{ color: 'var(--fg-subtle)' }} />
              : <ChevronDown size={16} style={{ color: 'var(--fg-subtle)' }} />}
          </div>
        </div>
      </button>

      {/* ── Corpo expandido ── */}
      {expanded && (
        <div style={{ padding: '0 20px 20px' }}>

          {semPlantio ? (
            <div className="rounded-xl p-4 text-center" style={{ background: 'var(--bg-card-alt, hsl(0 0% 96%))' }}>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                Registre a data de plantio para visualizar a fenologia esperada.
              </p>
            </div>
          ) : (
            <>
              {/* ── Info da fase esperada ── */}
              {faseEsperada && (
                <div className="rounded-xl p-4 mb-4 flex gap-3"
                  style={{ background: `${faseEsperada.color}12`, border: `1px solid ${faseEsperada.color}35` }}>
                  <div className="text-2xl mt-0.5">{faseEsperada.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold" style={{ color: faseEsperada.color }}>
                        {faseEsperada.label} — {faseEsperada.desc}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--fg-muted)' }}>
                        Dia {diasAposPlantio}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                      <span className="font-semibold" style={{ color: 'var(--fg)' }}>O que observar no campo:</span>{' '}
                      {faseEsperada.detalhe}
                    </p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--fg-subtle)' }}>
                        <span>Progresso do ciclo</span>
                        <span className="font-semibold" style={{ color: faseEsperada.color }}>{Math.min(pct, 100)}%</span>
                      </div>
                      <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(0,0,0,0.1)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%`, background: faseEsperada.color }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Linha do tempo ── */}
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--fg-subtle)', letterSpacing: '0.07em' }}>
                Linha do tempo fenológica
              </p>
              <div className="relative overflow-x-auto pb-2" style={{ marginBottom: 16 }}>
                <div className="flex gap-1.5" style={{ minWidth: `${dados.fases.length * 72}px` }}>
                  {dados.fases.map((fase, i) => {
                    const isEsperada  = i === idxEsperado
                    const isObservada = i === observadoIdx
                    const isPassed    = i < idxEsperado
                    const isFutura    = i > idxEsperado

                    return (
                      <div key={fase.id}
                        className="flex flex-col items-center gap-1"
                        style={{ flex: 1, minWidth: 64, opacity: isFutura ? 0.45 : 1, cursor: 'default' }}
                        title={`${fase.label}: ${fase.desc} (dia ${fase.diaInicio}–${fase.diaFim})`}
                      >
                        {/* Bolha */}
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold relative"
                          style={{
                            background: isEsperada ? fase.color : isPassed ? `${fase.color}55` : 'var(--bg-card-alt, #f3f4f6)',
                            border: isObservada ? `3px solid #2563eb` : isEsperada ? `2px solid ${fase.color}` : '1.5px solid var(--borda)',
                            boxShadow: isEsperada ? `0 0 0 4px ${fase.color}22` : isObservada ? '0 0 0 4px #2563eb22' : 'none',
                            color: isEsperada ? 'white' : isPassed ? fase.color : 'var(--fg-muted)',
                          }}
                        >
                          {isObservada && (
                            <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                              style={{ background: '#2563eb', color: 'white' }}>👁</div>
                          )}
                          {fase.icon}
                        </div>

                        {/* Linha conectora */}
                        {i < dados.fases.length - 1 && (
                          <div style={{
                            position: 'absolute',
                            left: `calc(${i * (100 / dados.fases.length)}% + 36px)`,
                            top: 18,
                            width: `calc(${100 / dados.fases.length}% - 36px)`,
                            height: 2,
                            background: isPassed ? fase.color : 'var(--borda)',
                            opacity: 0.5,
                            pointerEvents: 'none',
                          }} />
                        )}

                        {/* Label */}
                        <span className="text-[10px] font-bold text-center leading-tight"
                          style={{ color: isEsperada ? fase.color : isPassed ? fase.color : 'var(--fg-muted)' }}>
                          {fase.label}
                        </span>
                        <span className="text-[9px] text-center leading-tight"
                          style={{ color: 'var(--fg-subtle)', maxWidth: 60 }}>
                          D{fase.diaInicio}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Seção de comparação com campo ── */}
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-card-alt, hsl(0 0% 97%))' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Leaf size={13} style={{ color: '#2563eb' }} />
                    <p className="text-xs font-semibold" style={{ color: 'var(--fg)' }}>
                      O que você está vendo no campo?
                    </p>
                  </div>
                  <button
                    onClick={() => setShowObs(v => !v)}
                    className="text-xs font-semibold px-3 py-1 rounded-lg"
                    style={{ background: '#2563eb14', color: '#2563eb', border: '1px solid #2563eb30' }}
                  >
                    {obsIniciado ? '✏ Atualizar' : '+ Marcar estágio'}
                  </button>
                </div>

                {/* Seletor de estágio observado */}
                {showObs && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {dados.fases.map((fase, i) => (
                      <button
                        key={fase.id}
                        onClick={() => salvarObservacao(i)}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl text-center"
                        style={{
                          border: `1.5px solid ${i === observadoIdx ? '#2563eb' : 'var(--borda)'}`,
                          background: i === observadoIdx ? '#2563eb10' : 'var(--bg)',
                          cursor: 'pointer',
                        }}
                      >
                        <span className="text-lg">{fase.icon}</span>
                        <span className="text-[10px] font-bold" style={{ color: i === observadoIdx ? '#2563eb' : 'var(--fg)' }}>{fase.label}</span>
                        <span className="text-[9px] leading-tight" style={{ color: 'var(--fg-muted)' }}>{fase.desc}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Resultado da comparação */}
                {faseObservada ? (
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--fg-subtle)' }}>Esperado</p>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{faseEsperada?.icon}</span>
                          <span className="text-xs font-bold" style={{ color: faseEsperada?.color }}>{faseEsperada?.label} — {faseEsperada?.desc}</span>
                        </div>
                      </div>
                      <FlaskConical size={16} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--fg-subtle)' }}>Observado</p>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{faseObservada.icon}</span>
                          <span className="text-xs font-bold" style={{ color: '#2563eb' }}>{faseObservada.label} — {faseObservada.desc}</span>
                        </div>
                      </div>
                    </div>
                    {diffLabel && (
                      <div className="rounded-lg px-3 py-2 text-xs font-semibold"
                        style={{ background: `${diffColor}12`, color: diffColor, border: `1px solid ${diffColor}30` }}>
                        {diffLabel}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-center" style={{ color: 'var(--fg-muted)', padding: '4px 0' }}>
                    Marque o estágio que está vendo presencialmente para comparar com o esperado.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
