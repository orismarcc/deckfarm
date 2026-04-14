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
