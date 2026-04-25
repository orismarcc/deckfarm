// PDF report generator — uses jsPDF + jspdf-autotable (dynamic import, browser-only)
import type { Fazenda, Talhao, Produto, Aplicacao, Safra } from '@/types'

interface ReportData {
  fazenda: Fazenda
  talhoes: Talhao[]
  aplicacoes: Aplicacao[]
  produtos: Produto[]
  safra?: Safra
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  green:      [10,  91,  50]  as [number, number, number],
  greenLight: [232, 247, 238] as [number, number, number],
  greenMid:   [52,  145, 80]  as [number, number, number],
  red:        [200, 40,  40]  as [number, number, number],
  orange:     [180, 100, 0]   as [number, number, number],
  blue:       [37,  99,  235] as [number, number, number],
  gray:       [107, 114, 128] as [number, number, number],
  dark:       [30,  30,  30]  as [number, number, number],
  mid:        [75,  85,  99]  as [number, number, number],
  light:      [248, 250, 252] as [number, number, number],
  white:      [255, 255, 255] as [number, number, number],
  border:     [226, 232, 240] as [number, number, number],
}

function statusColor(status: string): [number, number, number] {
  if (status === 'Atrasado')  return C.red
  if (status === 'Hoje')      return C.blue
  if (status === 'Próximo')   return C.orange
  if (status === 'OK')        return C.green
  return C.gray
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    dentro_do_prazo: 'OK', proximo: 'Próximo', hoje: 'Hoje', atrasado: 'Atrasado',
  }
  return map[status] ?? status
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any

function drawHeader(doc: Doc, title: string, subtitle: string, geradoEm: string) {
  const W = 210
  // Green bar
  doc.setFillColor(...C.green)
  doc.rect(0, 0, W, 40, 'F')
  // Accent strip
  doc.setFillColor(...C.greenMid)
  doc.rect(0, 38, W, 2, 'F')

  // Brand
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('DeckFarm', 15, 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Gestão Agrícola Inteligente', 15, 24)

  // Report title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(title, 15, 33)

  // Generated at (right-aligned)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(subtitle, W - 15, 24, { align: 'right' })
  doc.text(`Gerado em: ${geradoEm}`, W - 15, 33, { align: 'right' })
}

function drawFazendaCard(doc: Doc, fazenda: Fazenda, safra: Safra | undefined, yStart: number): number {
  const W = 210
  let y = yStart

  doc.setFillColor(...C.greenLight)
  doc.rect(0, y, W, 1, 'F') // top separator
  doc.setFillColor(...C.light)
  doc.rect(14, y + 3, W - 28, 28, 'F')
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(14, y + 3, W - 28, 28, 2, 2)

  doc.setTextColor(...C.green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('PROPRIEDADE', 19, y + 10)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.dark)
  doc.setFontSize(8.5)

  const col2x = 105
  doc.setFont('helvetica', 'bold'); doc.text('Fazenda:', 19, y + 17); doc.setFont('helvetica', 'normal'); doc.text(fazenda.nome, 40, y + 17)
  doc.setFont('helvetica', 'bold'); doc.text('Local:', 19, y + 23); doc.setFont('helvetica', 'normal'); doc.text(fazenda.localizacao, 33, y + 23)

  if (fazenda.nome_produtor) {
    doc.setFont('helvetica', 'bold'); doc.text('Produtor:', col2x, y + 17); doc.setFont('helvetica', 'normal'); doc.text(fazenda.nome_produtor, col2x + 22, y + 17)
  }
  if (fazenda.area_total) {
    doc.setFont('helvetica', 'bold'); doc.text('Área:', col2x, y + 23); doc.setFont('helvetica', 'normal'); doc.text(`${fazenda.area_total.toLocaleString('pt-BR')} ha`, col2x + 15, y + 23)
  }
  if (safra) {
    doc.setFont('helvetica', 'bold'); doc.text('Safra:', 19, y + 29); doc.setFont('helvetica', 'normal'); doc.text(`${safra.nome} · ${safra.cultura}`, 33, y + 29)
  }

  return y + 36
}

function drawStatBoxes(
  doc: Doc,
  stats: { label: string; value: string; color?: [number,number,number] }[],
  yStart: number
): number {
  const boxW = (210 - 30 - (stats.length - 1) * 4) / stats.length
  stats.forEach((s, i) => {
    const x = 15 + i * (boxW + 4)
    doc.setFillColor(...(s.color ?? C.green))
    doc.roundedRect(x, yStart, boxW, 18, 2, 2, 'F')
    doc.setTextColor(...C.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.text(s.value, x + boxW / 2, yStart + 11, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text(s.label, x + boxW / 2, yStart + 16, { align: 'center' })
  })
  return yStart + 24
}

function drawSectionTitle(doc: Doc, title: string, y: number): number {
  doc.setFillColor(...C.greenLight)
  doc.rect(14, y, 182, 7, 'F')
  doc.setTextColor(...C.green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(title, 17, y + 5)
  doc.setTextColor(...C.dark)
  return y + 11
}

function drawFooter(doc: Doc) {
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...C.greenLight)
    doc.setLineWidth(0.4)
    doc.line(15, 286, 195, 286)
    doc.setFontSize(7)
    doc.setTextColor(...C.gray)
    doc.setFont('helvetica', 'normal')
    doc.text('DeckFarm — Gestão Agrícola Inteligente', 15, 291)
    doc.text(`Pág. ${i} / ${pages}`, 195, 291, { align: 'right' })
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateAplicacoesReport(data: ReportData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const now = new Date()
  const geradoEm = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

  drawHeader(doc, 'Relatório de Aplicações', `${data.talhoes.length} talhões`, geradoEm)

  let y = drawFazendaCard(doc, data.fazenda, data.safra, 46)

  // Stats
  const planejadas  = data.aplicacoes.filter(a => a.tipo !== 'realizada')
  const realizadas  = data.aplicacoes.filter(a => a.tipo === 'realizada')
  const atrasadas   = planejadas.filter(a => a.status === 'atrasado').length
  const proximas    = planejadas.filter(a => a.status === 'proximo').length
  const hoje        = planejadas.filter(a => a.status === 'hoje').length

  y = drawStatBoxes(doc, [
    { label: 'Total de Aplicações', value: String(data.aplicacoes.length) },
    { label: 'Realizadas',          value: String(realizadas.length),  color: C.greenMid },
    { label: 'Agendadas',           value: String(planejadas.length),  color: C.blue },
    { label: 'Atrasadas',           value: String(atrasadas),          color: atrasadas > 0 ? C.red : C.gray },
    { label: 'Próximas (7d)',        value: String(proximas + hoje),    color: proximas + hoje > 0 ? C.orange : C.gray },
  ], y)

  // ── Applications table ────────────────────────────────────────────────────
  y = drawSectionTitle(doc, 'HISTÓRICO COMPLETO DE APLICAÇÕES', y)

  const rows = [...data.aplicacoes]
    .sort((a, b) => b.data_aplicacao.localeCompare(a.data_aplicacao))
    .map(ap => {
      const talhao  = data.talhoes.find(t => t.id === ap.talhao_id)
      const produto = data.produtos.find(p => p.id === ap.produto_id)
      return [
        fmtDate(ap.data_aplicacao),
        talhao?.nome  ?? '-',
        ap.tipo === 'realizada' ? 'Realizada' : 'Agendada',
        produto?.nome ?? '-',
        ap.dose ? `${ap.dose} ${ap.unidade_dose ?? 'L/ha'}` : '-',
        ap.area_aplicada ? `${ap.area_aplicada} ha` : '-',
        ap.clima ?? '-',
        ap.temperatura ? `${ap.temperatura}°C` : '-',
        statusLabel(ap.status),
        ap.observacoes ?? '',
      ]
    })

  autoTable(doc, {
    startY: y,
    head: [['Data', 'Talhão', 'Tipo', 'Produto', 'Dose', 'Área', 'Clima', 'Temp.', 'Status', 'Obs.']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 7, cellPadding: 2.5 },
    bodyStyles: { fontSize: 6.5, cellPadding: 2 },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: {
      0: { cellWidth: 17 },
      1: { cellWidth: 26 },
      2: { cellWidth: 18 },
      3: { cellWidth: 35 },
      4: { cellWidth: 17 },
      5: { cellWidth: 13 },
      6: { cellWidth: 16 },
      7: { cellWidth: 12 },
      8: { cellWidth: 16 },
      9: { cellWidth: 'auto' },
    },
    margin: { left: 15, right: 15 },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    willDrawCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 8) {
        const v = data.cell.text[0]
        const col = statusColor(v)
        data.cell.styles.textColor = col
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.section === 'body' && data.column.index === 2) {
        const v = data.cell.text[0]
        data.cell.styles.textColor = v === 'Realizada' ? C.green : C.blue
      }
    },
  })

  // ── Per-talhão breakdown ──────────────────────────────────────────────────
  for (const talhao of data.talhoes) {
    const apps = data.aplicacoes.filter(a => a.talhao_id === talhao.id)
    if (apps.length === 0) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const curY = (doc as any).lastAutoTable?.finalY ?? 280
    if (curY > 220) doc.addPage()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const startY = (doc as any).lastAutoTable?.finalY
      ? (doc as any).lastAutoTable.finalY + 10
      : 50

    // Talhão header
    doc.setFillColor(...C.green)
    doc.roundedRect(15, startY, 182, 10, 2, 2, 'F')
    doc.setTextColor(...C.white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text(`${talhao.nome}  ·  ${talhao.area} ha  ·  ${talhao.cultura}`, 19, startY + 7)

    const talhaoRows = apps
      .sort((a, b) => b.data_aplicacao.localeCompare(a.data_aplicacao))
      .map(ap => {
        const produto = data.produtos.find(p => p.id === ap.produto_id)
        return [
          fmtDate(ap.data_aplicacao),
          ap.tipo === 'realizada' ? 'Realizada' : 'Agendada',
          produto?.nome ?? '-',
          ap.dose ? `${ap.dose} ${ap.unidade_dose ?? 'L/ha'}` : '-',
          ap.area_aplicada ? `${ap.area_aplicada} ha` : '-',
          ap.responsavel ?? '-',
          ap.clima ?? '-',
          statusLabel(ap.status),
          ap.observacoes ?? '',
        ]
      })

    autoTable(doc, {
      startY: startY + 12,
      head: [['Data', 'Tipo', 'Produto', 'Dose', 'Área', 'Responsável', 'Clima', 'Status', 'Obs.']],
      body: talhaoRows,
      theme: 'striped',
      headStyles: { fillColor: C.greenLight, textColor: C.green, fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
      bodyStyles: { fontSize: 6.5, cellPadding: 2 },
      alternateRowStyles: { fillColor: [250, 253, 251] as [number, number, number] },
      columnStyles: {
        0: { cellWidth: 17 },
        1: { cellWidth: 18 },
        2: { cellWidth: 40 },
        3: { cellWidth: 20 },
        4: { cellWidth: 14 },
        5: { cellWidth: 28 },
        6: { cellWidth: 18 },
        7: { cellWidth: 16 },
        8: { cellWidth: 'auto' },
      },
      margin: { left: 15, right: 15 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      willDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 7) {
          data.cell.styles.textColor = statusColor(data.cell.text[0])
          data.cell.styles.fontStyle = 'bold'
        }
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = data.cell.text[0] === 'Realizada' ? C.green : C.blue
        }
      },
    })
  }

  drawFooter(doc)

  const filename = `DeckFarm_${data.fazenda.nome.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

// ── Calda report (unchanged logic, improved styling) ──────────────────────────
export interface CaldaReportData {
  taxa: number
  capacidade: number
  volumeTotal: number
  numTanques: number
  sobra: number
  talhoes: { nome: string; fazendaNome: string; area: number; volume: number; tanques: number }[]
  fazendas: { nome: string; localizacao: string; nome_produtor?: string }[]
  geradoEm: string
}

export async function generateCaldaReport(data: CaldaReportData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  drawHeader(doc, 'Relatório de Calda — Cálculo de Pulverização', '', data.geradoEm)

  let y = 48

  // Fazendas
  doc.setFillColor(...C.light)
  doc.rect(14, y, 182, data.fazendas.length * 8 + 12, 'F')
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.3)
  doc.roundedRect(14, y, 182, data.fazendas.length * 8 + 12, 2, 2)
  doc.setTextColor(...C.green)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('FAZENDAS SELECIONADAS', 19, y + 8)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.dark)
  doc.setFontSize(8.5)
  data.fazendas.forEach(f => {
    const produtor = f.nome_produtor ? ` · ${f.nome_produtor}` : ''
    doc.text(`${f.nome} — ${f.localizacao}${produtor}`, 19, y)
    y += 7
  })
  y += 6

  // Parameter boxes
  doc.setFillColor(...C.green)
  doc.roundedRect(15, y, 85, 22, 2, 2, 'F')
  doc.roundedRect(105, y, 85, 22, 2, 2, 'F')
  doc.setTextColor(...C.white)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('Taxa de aplicação', 57.5, y + 7, { align: 'center' })
  doc.text('Capacidade do tanque', 147.5, y + 7, { align: 'center' })
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text(`${data.taxa} L/ha`, 57.5, y + 17, { align: 'center' })
  doc.text(`${data.capacidade} L`, 147.5, y + 17, { align: 'center' })
  y += 28

  // Summary stats
  const stats = [
    { label: 'Volume Total',            value: `${data.volumeTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L` },
    { label: 'Nº de Tanques',           value: String(data.numTanques) },
    { label: 'Sobra no Último Tanque',  value: `${data.sobra.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L` },
  ]
  y = drawStatBoxes(doc, stats, y)

  y = drawSectionTitle(doc, 'DISTRIBUIÇÃO POR TALHÃO', y)

  const totalArea = data.talhoes.reduce((s, t) => s + t.area, 0)
  const rows = data.talhoes.map(t => [
    t.nome,
    t.fazendaNome,
    t.area.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    t.volume.toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
    String(t.tanques),
  ])

  autoTable(doc, {
    startY: y,
    head: [['Talhão', 'Fazenda', 'Área (ha)', 'Volume (L)', 'Tanques']],
    body: rows,
    foot: [[
      'TOTAL', '',
      totalArea.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      data.volumeTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
      String(data.numTanques),
    ]],
    theme: 'grid',
    headStyles: { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.5 },
    footStyles: { fillColor: C.greenLight, textColor: C.green, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    alternateRowStyles: { fillColor: C.light },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 55 },
      2: { cellWidth: 27, halign: 'right' },
      3: { cellWidth: 27, halign: 'right' },
      4: { cellWidth: 23, halign: 'right' },
    },
    margin: { left: 15, right: 15 },
  })

  drawFooter(doc)
  doc.save(`DeckFarm_Calda_${new Date().toISOString().split('T')[0]}.pdf`)
}
