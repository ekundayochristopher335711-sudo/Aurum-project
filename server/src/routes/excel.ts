import express from 'express'
import ExcelJS from 'exceljs'
import multer from 'multer'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requireProjectAccess } from '../middleware/roleCheck'
import { logAudit } from '../services/auditService'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const GOLD = 'FFB8860B'
const NAVY = 'FF0F172A'
const LIGHT = 'FFF8FAFC'
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
const CELL_FONT = { size: 9 }

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = { bottom: { style: 'thin', color: { argb: GOLD } } }
  })
  row.height = 22
}

function styleDataRow(row: ExcelJS.Row, even: boolean) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: even ? LIGHT : 'FFFFFFFF' } }
    cell.font = CELL_FONT
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }
  })
  row.height = 20
}

function addTitleRow(sheet: ExcelJS.Worksheet, title: string, colCount: number) {
  const row = sheet.addRow([title])
  sheet.mergeCells(`A1:${String.fromCharCode(64 + colCount)}1`)
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
  row.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
  row.height = 32
  sheet.addRow([])
}

// ─── EXPORT RISK REGISTER ───────────────────────────────────────────────────

router.get('/:projectId/exports/risks', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } })
    const risks = await prisma.riskItem.findMany({
      where: { projectId: req.params.projectId },
      include: { earlyWarning: { select: { ewNumber: true } } },
      orderBy: { riskId: 'asc' },
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Aurum Project Controls'
    wb.created = new Date()

    const ws = wb.addWorksheet('Risk Register', { pageSetup: { orientation: 'landscape', fitToPage: true } })
    addTitleRow(ws, `Risk Register — ${project?.name}`, 9)

    ws.columns = [
      { key: 'riskId', width: 12 },
      { key: 'description', width: 40 },
      { key: 'probability', width: 12 },
      { key: 'costImpact', width: 16 },
      { key: 'timeImpact', width: 12 },
      { key: 'mitigation', width: 35 },
      { key: 'owner', width: 18 },
      { key: 'ewNumber', width: 12 },
      { key: 'status', width: 14 },
    ]

    const header = ws.addRow(['Risk ID', 'Description', 'Probability (1-5)', 'Cost Impact (£)', 'Time Impact (days)', 'Mitigation', 'Owner', 'Linked EW', 'Status'])
    styleHeader(header)

    risks.forEach((r, i) => {
      const row = ws.addRow({
        riskId: r.riskId,
        description: r.description,
        probability: r.probability,
        costImpact: r.costImpact ?? '',
        timeImpact: r.timeImpact ?? '',
        mitigation: r.mitigation ?? '',
        owner: r.owner ?? '',
        ewNumber: r.earlyWarning?.ewNumber ?? '',
        status: r.status,
      })
      styleDataRow(row, i % 2 === 0)

      // Color status cell
      const statusCell = row.getCell('status')
      if (r.status === 'OPEN') statusCell.font = { ...CELL_FONT, color: { argb: 'FFDC2626' }, bold: true }
      else if (r.status === 'MITIGATED') statusCell.font = { ...CELL_FONT, color: { argb: 'FFB45309' }, bold: true }
      else statusCell.font = { ...CELL_FONT, color: { argb: 'FF16A34A' }, bold: true }
    })

    // Summary row
    const totalExposure = risks.filter((r) => r.status === 'OPEN').reduce((s, r) => s + (r.costImpact ?? 0), 0)
    ws.addRow([])
    const sumRow = ws.addRow(['', `Total open risks: ${risks.filter((r) => r.status === 'OPEN').length}`, '', totalExposure, '', '', '', '', ''])
    sumRow.getCell(1).value = 'SUMMARY'
    sumRow.getCell(1).font = { bold: true, size: 10 }
    sumRow.getCell(4).numFmt = '£#,##0'
    sumRow.getCell(4).font = { bold: true, color: { argb: 'FFDC2626' }, size: 10 }

    await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'RiskRegister', entityId: req.params.projectId, action: 'EXPORT', ipAddress: req.ip })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="Risk-Register-${new Date().toISOString().split('T')[0]}.xlsx"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Export failed' })
  }
})

// ─── EXPORT CE SUMMARY ───────────────────────────────────────────────────────

router.get('/:projectId/exports/ces', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } })
    const ces = await prisma.compensationEvent.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { ceNumber: 'asc' },
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Aurum Project Controls'

    const ws = wb.addWorksheet('CE Summary', { pageSetup: { orientation: 'landscape', fitToPage: true } })
    addTitleRow(ws, `Compensation Event Summary — ${project?.name}`, 8)

    ws.columns = [
      { key: 'ceNumber', width: 12 },
      { key: 'title', width: 38 },
      { key: 'clauseRef', width: 14 },
      { key: 'dateNotified', width: 16 },
      { key: 'dateResponseDue', width: 18 },
      { key: 'valuationAmount', width: 18 },
      { key: 'status', width: 16 },
      { key: 'description', width: 40 },
    ]

    const header = ws.addRow(['CE No.', 'Title', 'Clause Ref', 'Date Notified', 'Response Due', 'Valuation (£)', 'Status', 'Description'])
    styleHeader(header)

    ces.forEach((ce, i) => {
      const row = ws.addRow({
        ceNumber: ce.ceNumber,
        title: ce.title,
        clauseRef: ce.clauseRef ?? '',
        dateNotified: ce.dateNotified ? new Date(ce.dateNotified).toLocaleDateString('en-GB') : '',
        dateResponseDue: ce.dateResponseDue ? new Date(ce.dateResponseDue).toLocaleDateString('en-GB') : '',
        valuationAmount: ce.valuationAmount ?? '',
        status: ce.status,
        description: ce.description,
      })
      styleDataRow(row, i % 2 === 0)

      const isOverdue = ce.dateResponseDue && new Date(ce.dateResponseDue) < new Date() && ce.status !== 'CLOSED'
      if (isOverdue) {
        row.getCell('dateResponseDue').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
        row.getCell('dateResponseDue').font = { ...CELL_FONT, color: { argb: 'FFDC2626' }, bold: true }
      }

      const valCell = row.getCell('valuationAmount')
      if (ce.valuationAmount) valCell.numFmt = '£#,##0'
    })

    // Totals
    const total = ces.reduce((s, ce) => s + (ce.valuationAmount ?? 0), 0)
    ws.addRow([])
    const totalRow = ws.addRow(['', 'TOTAL VALUATION', '', '', '', total, '', ''])
    totalRow.getCell(2).font = { bold: true, size: 10 }
    totalRow.getCell(6).numFmt = '£#,##0'
    totalRow.getCell(6).font = { bold: true, color: { argb: 'FFB8860B' }, size: 11 }

    await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'CESummary', entityId: req.params.projectId, action: 'EXPORT', ipAddress: req.ip })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="CE-Summary-${new Date().toISOString().split('T')[0]}.xlsx"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Export failed' })
  }
})

// ─── IMPORT RISKS FROM EXCEL ─────────────────────────────────────────────────

router.post('/:projectId/imports/risks',
  authenticate,
  requireProjectAccess,
  upload.single('file'),
  async (req: AuthRequest, res): Promise<void> => {
    if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return }

    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(req.file.buffer)
      const ws = wb.worksheets[0]

      const imported: string[] = []
      const errors: string[] = []
      let count = await prisma.riskItem.count({ where: { projectId: req.params.projectId } })

      ws.eachRow((row, rowNum) => {
        if (rowNum <= 3) return // skip title + blank + header rows

        const description = String(row.getCell(2).value ?? '').trim()
        if (!description) return

        const probability = Number(row.getCell(3).value) || 3
        const costImpact = Number(row.getCell(4).value) || null
        const timeImpact = Number(row.getCell(5).value) || null
        const mitigation = String(row.getCell(6).value ?? '').trim() || null
        const owner = String(row.getCell(7).value ?? '').trim() || null

        if (probability < 1 || probability > 5) {
          errors.push(`Row ${rowNum}: probability must be 1-5`)
          return
        }

        count++
        imported.push(JSON.stringify({ description, probability, costImpact, timeImpact, mitigation, owner, riskId: `R-${String(count).padStart(3, '0')}` }))
      })

      const created = []
      for (const item of imported) {
        const data = JSON.parse(item)
        const risk = await prisma.riskItem.create({
          data: { ...data, projectId: req.params.projectId },
        })
        created.push(risk)
      }

      await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'RiskItem', entityId: req.params.projectId, action: 'CREATE', ipAddress: req.ip })
      res.json({ imported: created.length, errors })
    } catch (e) {
      console.error(e)
      res.status(500).json({ message: 'Import failed' })
    }
  },
)

export default router
