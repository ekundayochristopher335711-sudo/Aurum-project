import express from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requireProjectAccess } from '../middleware/roleCheck'
import { logAudit } from '../services/auditService'
import { generateEarlyWarningPDF } from '../services/pdfService'

const router = express.Router()

router.get('/:projectId/notices', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { type, ceId } = req.query
    const notices = await prisma.notice.findMany({
      where: {
        projectId: req.params.projectId,
        ...(type ? { type: type as string } : {}),
        ...(ceId ? { ceId: ceId as string } : {}),
      },
      include: { ce: { select: { id: true, ceNumber: true, title: true } } },
      orderBy: { dateIssued: 'desc' },
    })
    res.json(notices)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/:projectId/notices',
  authenticate,
  requireProjectAccess,
  body('title').notEmpty().trim(),
  body('content').notEmpty().trim(),
  body('type').notEmpty(),
  body('issuedTo').notEmpty().trim(),
  body('dateIssued').isISO8601(),
  async (req: AuthRequest, res): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    try {
      const count = await prisma.notice.count({ where: { projectId: req.params.projectId } })
      const noticeNumber = `N-${String(count + 1).padStart(3, '0')}`

      const { title, content, type, issuedTo, ceId, dateIssued, dueDate } = req.body
      const notice = await prisma.notice.create({
        data: {
          noticeNumber,
          projectId: req.params.projectId,
          title,
          content,
          type,
          issuedBy: req.user!.id,
          issuedTo,
          ceId: ceId || null,
          dateIssued: new Date(dateIssued),
          dueDate: dueDate ? new Date(dueDate) : null,
        },
        include: { ce: { select: { id: true, ceNumber: true, title: true } } },
      })
      await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'Notice', entityId: notice.id, action: 'CREATE', ipAddress: req.ip })
      res.status(201).json(notice)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.get('/:projectId/notices/:id/pdf', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    const notice = await prisma.notice.findUnique({
      where: { id: req.params.id },
      include: { ce: true },
    })
    if (!notice) { res.status(404).json({ message: 'Notice not found' }); return }

    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } })
    await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'Notice', entityId: notice.id, action: 'EXPORT', ipAddress: req.ip })
    generateEarlyWarningPDF(res, notice as unknown as Record<string, unknown>, project?.name || 'Project')
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.delete('/:projectId/notices/:id', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    await prisma.notice.delete({ where: { id: req.params.id } })
    await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'Notice', entityId: req.params.id, action: 'DELETE', ipAddress: req.ip })
    res.status(204).send()
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
