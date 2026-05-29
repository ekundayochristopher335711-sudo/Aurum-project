import PDFDocument from 'pdfkit'
import { Response } from 'express'

const GOLD = '#B8860B'
const NAVY = '#0F172A'
const LIGHT = '#F8FAFC'

function addHeader(doc: InstanceType<typeof PDFDocument>, title: string, projectName: string) {
  doc.rect(0, 0, doc.page.width, 80).fill(NAVY)
  doc.fontSize(20).fillColor('#FFFFFF').text('AURUM PROJECT CONTROLS', 40, 20)
  doc.fontSize(10).fillColor(GOLD).text(title.toUpperCase(), 40, 48)
  doc.fontSize(9).fillColor('#94A3B8').text(projectName, 40, 62)
  doc.fillColor(NAVY)
  doc.moveDown(5)
}

function addFooter(doc: InstanceType<typeof PDFDocument>, pageNum: number) {
  const y = doc.page.height - 40
  doc.rect(0, y - 10, doc.page.width, 50).fill(LIGHT)
  doc.fontSize(8).fillColor('#64748B')
    .text(`Generated: ${new Date().toLocaleString('en-GB')}   |   CONFIDENTIAL`, 40, y)
    .text(`Page ${pageNum}`, doc.page.width - 80, y, { align: 'right' })
}

function sectionTitle(doc: InstanceType<typeof PDFDocument>, text: string) {
  doc.rect(40, doc.y, doc.page.width - 80, 22).fill(GOLD)
  doc.fontSize(11).fillColor('#FFFFFF').text(text, 48, doc.y - 18)
  doc.fillColor(NAVY).moveDown(1.5)
}

function tableRow(
  doc: InstanceType<typeof PDFDocument>,
  cols: string[],
  widths: number[],
  isHeader = false,
  y?: number,
) {
  const startY = y ?? doc.y
  let x = 40
  if (isHeader) doc.rect(40, startY, widths.reduce((a, b) => a + b, 0), 18).fill('#E2E8F0')
  cols.forEach((col, i) => {
    doc
      .fontSize(isHeader ? 9 : 8)
      .fillColor(isHeader ? NAVY : '#334155')
      .text(col, x + 4, startY + 4, { width: widths[i] - 8, lineBreak: false })
    x += widths[i]
  })
  doc.moveTo(40, startY + 20).lineTo(40 + widths.reduce((a, b) => a + b, 0), startY + 20).strokeColor('#E2E8F0').stroke()
  doc.y = startY + 22
}

export function generateEarlyWarningPDF(
  res: Response,
  ew: Record<string, unknown>,
  projectName: string,
) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="EW-${ew['ewNumber']}.pdf"`)
  doc.pipe(res)

  addHeader(doc, 'Early Warning Notice', projectName)

  sectionTitle(doc, 'Early Warning Details')
  const fields = [
    ['EW Number', String(ew['ewNumber'] ?? '')],
    ['Title', String(ew['title'] ?? '')],
    ['Status', String(ew['status'] ?? '')],
    ['Date Raised', ew['dateRaised'] ? new Date(ew['dateRaised'] as string).toLocaleDateString('en-GB') : ''],
    ['Date Required', ew['dateRequired'] ? new Date(ew['dateRequired'] as string).toLocaleDateString('en-GB') : 'N/A'],
    ['Raised By', String(ew['raisedBy'] ?? '')],
    ['Assigned To', String(ew['assignedTo'] ?? 'Unassigned')],
  ]
  fields.forEach(([label, value]) => {
    doc.fontSize(9).fillColor('#64748B').text(label + ':', 40, doc.y, { continued: true, width: 160 })
    doc.fillColor(NAVY).text(' ' + value)
    doc.moveDown(0.3)
  })

  doc.moveDown(1)
  sectionTitle(doc, 'Description')
  doc.fontSize(9).fillColor(NAVY).text(String(ew['description'] ?? ''), { lineGap: 4 })

  addFooter(doc, 1)
  doc.end()
}

export function generateRiskRegisterPDF(
  res: Response,
  risks: Record<string, unknown>[],
  projectName: string,
) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename="Risk-Register.pdf"')
  doc.pipe(res)

  addHeader(doc, 'Risk Register', projectName)
  sectionTitle(doc, `Risk Register — ${risks.length} item(s)`)

  const cols = ['Risk ID', 'Description', 'Prob', 'Cost (£)', 'Time (d)', 'Status', 'Owner']
  const widths = [70, 250, 45, 80, 60, 75, 100]
  tableRow(doc, cols, widths, true)

  risks.forEach((r) => {
    const costRaw = r['costImpact']
    const cost = typeof costRaw === 'number' ? costRaw.toLocaleString('en-GB') : 'N/A'
    tableRow(doc, [
      String(r['riskId'] ?? ''),
      String(r['description'] ?? '').substring(0, 80),
      String(r['probability'] ?? ''),
      cost,
      r['timeImpact'] != null ? String(r['timeImpact']) : 'N/A',
      String(r['status'] ?? ''),
      String(r['owner'] ?? 'TBC'),
    ], widths)
    if (doc.y > doc.page.height - 80) { doc.addPage(); addHeader(doc, 'Risk Register (cont.)', projectName) }
  })

  addFooter(doc, 1)
  doc.end()
}

export function generateCESummaryPDF(
  res: Response,
  ces: Record<string, unknown>[],
  projectName: string,
) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename="CE-Summary.pdf"')
  doc.pipe(res)

  addHeader(doc, 'Compensation Event Summary', projectName)

  const total = ces.reduce((sum, ce) => {
    const v = ce['valuationAmount']
    return sum + (typeof v === 'number' ? v : 0)
  }, 0)

  doc.fontSize(10).fillColor(NAVY)
    .text(`Total CEs: ${ces.length}   |   Total Valuation: £${total.toLocaleString('en-GB')}`, 40, doc.y)
  doc.moveDown(1)

  sectionTitle(doc, 'Compensation Events')
  const cols = ['CE No.', 'Title', 'Clause', 'Date Notified', 'Due Date', 'Valuation (£)', 'Status']
  const widths = [60, 220, 60, 90, 90, 100, 90]
  tableRow(doc, cols, widths, true)

  ces.forEach((ce) => {
    const val = ce['valuationAmount']
    tableRow(doc, [
      String(ce['ceNumber'] ?? ''),
      String(ce['title'] ?? '').substring(0, 50),
      String(ce['clauseRef'] ?? 'N/A'),
      ce['dateNotified'] ? new Date(ce['dateNotified'] as string).toLocaleDateString('en-GB') : '',
      ce['dateResponseDue'] ? new Date(ce['dateResponseDue'] as string).toLocaleDateString('en-GB') : 'N/A',
      typeof val === 'number' ? val.toLocaleString('en-GB') : 'TBD',
      String(ce['status'] ?? ''),
    ], widths)
    if (doc.y > doc.page.height - 80) { doc.addPage(); addHeader(doc, 'CE Summary (cont.)', projectName) }
  })

  addFooter(doc, 1)
  doc.end()
}

export function generateCommercialDashboardPDF(
  res: Response,
  data: {
    projectName: string
    openEWs: number
    openRisks: number
    openCEs: number
    totalCEValue: number
    riskExposure: number
    overdueItems: number
    cesByStatus: { status: string; count: number }[]
  },
) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'attachment; filename="Commercial-Dashboard.pdf"')
  doc.pipe(res)

  addHeader(doc, 'Commercial Dashboard Report', data.projectName)

  sectionTitle(doc, 'Key Performance Indicators')
  const kpis = [
    ['Open Early Warnings', String(data.openEWs)],
    ['Open Risk Items', String(data.openRisks)],
    ['Open Compensation Events', String(data.openCEs)],
    ['Total CE Valuation', `£${data.totalCEValue.toLocaleString('en-GB')}`],
    ['Risk Exposure (Cost)', `£${data.riskExposure.toLocaleString('en-GB')}`],
    ['Overdue Items', String(data.overdueItems)],
  ]

  const cols = 2
  const kpiWidth = (doc.page.width - 80) / cols
  kpis.forEach(([label, value], i) => {
    const x = 40 + (i % cols) * kpiWidth
    const y = doc.y
    doc.rect(x + 4, y, kpiWidth - 8, 50).fill(i % 2 === 0 ? LIGHT : '#F1F5F9').stroke('#E2E8F0')
    doc.fontSize(9).fillColor('#64748B').text(label, x + 12, y + 8, { width: kpiWidth - 20 })
    doc.fontSize(18).fillColor(GOLD).text(value, x + 12, y + 22, { width: kpiWidth - 20 })
    if (i % cols === cols - 1) doc.y = y + 60
  })

  doc.moveDown(2)
  sectionTitle(doc, 'CE Status Breakdown')
  const statusCols = ['Status', 'Count']
  const statusWidths = [200, 100]
  tableRow(doc, statusCols, statusWidths, true)
  data.cesByStatus.forEach((row) => tableRow(doc, [row.status, String(row.count)], statusWidths))

  addFooter(doc, 1)
  doc.end()
}
