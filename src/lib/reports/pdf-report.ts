// PDF report generator — uses jsPDF + jspdf-autotable (dynamic import, browser-only)
import type { Fazenda, Talhao, Produto, Aplicacao, Safra } from '@/types'

interface ReportData {
  fazenda: Fazenda
  talhoes: Talhao[]
  aplicacoes: Aplicacao[]
  produtos: Produto[]
  safra?: Safra
}

const PRIMARY: [number, number, number] = [10, 91, 50]
const LIGHT_GREEN: [number, number, number] = [232, 247, 238]

export async function generateAplicacoesReport(data: ReportData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  /* ── HEADER ── */
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, 210, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('DeckFarm', 15, 16)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Gestão Agrícola Inteligente', 15, 23)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Relatório de Aplicações', 15, 32)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 140, 32)

  /* ── FAZENDA INFO ── */
  doc.setFillColor(...LIGHT_GREEN)
  doc.rect(0, 38, 210, 32, 'F')

  doc.setTextColor(...PRIMARY)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('INFORMAÇÕES DA FAZENDA', 15, 48)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(45, 45, 45)
  doc.setFontSize(8.5)
  doc.text(`Fazenda: ${data.fazenda.nome}`, 15, 56)
  doc.text(`Localização: ${data.fazenda.localizacao}`, 15, 62)
  if (data.fazenda.nome_produtor) doc.text(`Produtor: ${data.fazenda.nome_produtor}`, 110, 56)
  if (data.fazenda.area_total)   doc.text(`Área Total: ${data.fazenda.area_total.toLocaleString('pt-BR')} ha`, 110, 62)
  if (data.safra)                doc.text(`Safra: ${data.safra.nome}  |  Cultura: ${data.safra.cultura}`, 15, 68)

  /* ── STAT BOXES ── */
  const yStats = 76
  const atrasadas   = data.aplicacoes.filter(a => a.status === 'atrasado').length
  const dentroP     = data.aplicacoes.filter(a => a.status === 'dentro_do_prazo').length
  const stats = [
    { label: 'Total Aplicações', value: String(data.aplicacoes.length) },
    { label: 'Dentro do Prazo',  value: String(dentroP) },
    { label: 'Atrasadas',        value: String(atrasadas) },
    { label: 'Talhões',          value: String(data.talhoes.length) },
  ]
  stats.forEach((s, i) => {
    const x = 15 + i * 47
    doc.setFillColor(...PRIMARY)
    doc.roundedRect(x, yStats, 43, 16, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(s.value, x + 21.5, yStats + 10, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text(s.label, x + 21.5, yStats + 14.5, { align: 'center' })
  })

  /* ── SECTION TITLE ── */
  const yTable = yStats + 24
  doc.setTextColor(...PRIMARY)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('HISTÓRICO DE APLICAÇÕES', 15, yTable)

  /* ── TABLE ── */
  const rows = data.aplicacoes
    .sort((a, b) => b.data_aplicacao.localeCompare(a.data_aplicacao))
    .map(ap => {
      const talhao  = data.talhoes.find(t => t.id === ap.talhao_id)
      const produto = data.produtos.find(p => p.id === ap.produto_id)
      const statusMap: Record<string, string> = {
        dentro_do_prazo: 'OK', proximo: 'Próximo', hoje: 'Hoje', atrasado: 'Atrasado',
      }
      return [
        new Date(ap.data_aplicacao + 'T12:00:00').toLocaleDateString('pt-BR'),
        talhao?.nome  || '-',
        produto?.nome || '-',
        ap.dose ? `${ap.dose} ${ap.unidade_dose || 'L/ha'}` : '-',
        ap.area_aplicada ? `${ap.area_aplicada} ha` : '-',
        ap.clima || '-',
        ap.temperatura ? `${ap.temperatura}°C` : '-',
        statusMap[ap.status] || ap.status,
        ap.observacoes || '',
      ]
    })

  autoTable(doc, {
    startY: yTable + 4,
    head: [['Data', 'Talhão', 'Produto', 'Dose', 'Área', 'Clima', 'Temp.', 'Status', 'Obs.']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 253, 250] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 28 },
      2: { cellWidth: 40 },
      3: { cellWidth: 18 },
      4: { cellWidth: 15 },
      5: { cellWidth: 20 },
      6: { cellWidth: 14 },
      7: { cellWidth: 18 },
      8: { cellWidth: 'auto' },
    },
    margin: { left: 15, right: 15 },
    // Colorir status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    willDrawCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 7) {
        const v = data.cell.text[0]
        if (v === 'Atrasado') data.cell.styles.textColor = [200, 40, 40]
        if (v === 'OK')       data.cell.styles.textColor = [10, 91, 50]
      }
    },
  })

  /* ── FOOTER ── */
  const pages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text(`DeckFarm — Gestão Agrícola  |  Pág. ${i}/${pages}`, 105, 290, { align: 'center' })
  }

  const filename = `DeckFarm_${data.fazenda.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

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

  /* ── HEADER ── */
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, 210, 36, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('DeckFarm', 15, 16)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Gestão Agrícola Inteligente', 15, 23)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Relatório de Calda — Cálculo de Pulverização', 15, 32)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Gerado em: ${data.geradoEm}`, 140, 32)

  /* ── FAZENDAS SECTION ── */
  let yPos = 44
  doc.setFillColor(...LIGHT_GREEN)
  doc.rect(0, 38, 210, data.fazendas.length * 8 + 14, 'F')
  doc.setTextColor(...PRIMARY)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('FAZENDAS SELECIONADAS', 15, yPos)
  yPos += 7
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(45, 45, 45)
  doc.setFontSize(8.5)
  data.fazendas.forEach(f => {
    const produtor = f.nome_produtor ? ` · ${f.nome_produtor}` : ''
    doc.text(`${f.nome} — ${f.localizacao}${produtor}`, 15, yPos)
    yPos += 7
  })

  /* ── PARAMETER BOX ── */
  yPos += 4
  doc.setFillColor(...PRIMARY)
  doc.roundedRect(15, yPos, 85, 22, 2, 2, 'F')
  doc.roundedRect(105, yPos, 85, 22, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('Taxa de aplicação', 57.5, yPos + 7, { align: 'center' })
  doc.text('Capacidade do tanque', 147.5, yPos + 7, { align: 'center' })
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${data.taxa} L/ha`, 57.5, yPos + 16, { align: 'center' })
  doc.text(`${data.capacidade} L`, 147.5, yPos + 16, { align: 'center' })
  yPos += 28

  /* ── SUMMARY STATS ── */
  const stats = [
    { label: 'Volume Total', value: `${data.volumeTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L` },
    { label: 'Nº de Tanques', value: String(data.numTanques) },
    { label: 'Sobra no Último Tanque', value: `${data.sobra.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L` },
  ]
  stats.forEach((s, i) => {
    const x = 15 + i * 60
    doc.setFillColor(10, 91, 50)
    doc.roundedRect(x, yPos, 56, 18, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(s.value, x + 28, yPos + 11, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.text(s.label, x + 28, yPos + 16, { align: 'center' })
  })
  yPos += 24

  /* ── SECTION TITLE ── */
  doc.setTextColor(...PRIMARY)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('DISTRIBUIÇÃO POR TALHÃO', 15, yPos)
  yPos += 4

  /* ── TABLE ── */
  const rows = data.talhoes.map(t => [
    t.nome,
    t.fazendaNome,
    t.area.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    t.volume.toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
    String(t.tanques),
  ])

  const totalArea = data.talhoes.reduce((s, t) => s + t.area, 0)

  autoTable(doc, {
    startY: yPos,
    head: [['Talhão', 'Fazenda', 'Área (ha)', 'Volume (L)', 'Tanques']],
    body: rows,
    foot: [[
      'TOTAL', '',
      totalArea.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      data.volumeTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 }),
      String(data.numTanques),
    ]],
    theme: 'striped',
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    footStyles: { fillColor: LIGHT_GREEN, textColor: PRIMARY, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 253, 250] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 50 },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
    },
    margin: { left: 15, right: 15 },
  })

  /* ── FOOTER ── */
  const pages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text(`DeckFarm — Gestão Agrícola  |  Pág. ${i}/${pages}`, 105, 290, { align: 'center' })
  }

  const filename = `DeckFarm_Calda_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
