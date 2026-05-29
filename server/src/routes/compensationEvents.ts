import express from 'express'
import { body, validationResult } from 'express-validator'
import multer from 'multer'
import path from 'path'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requireProjectAccess } from '../middleware/roleCheck'
import { logAudit, diffObjects } from '../services/auditService'

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

const router = express.Router()

router.get('/:projectId/compensation-events', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { status } = req.query
    const ces = await prisma.compensationEvent.findMany({
      where: {
        projectId: req.params.projectId,
        ...(status ? { status: status as 'NOTIFIED' | 'QUOTED' | 'ASSESSED' | 'IMPLEMENTED' | 'CLOSED' } : {}),
      },
      include: {
        notices: { select: { id: true, noticeNumber: true, type: true, dateIssued: true } },
        documents: true,
        _count: { select: { notices: true, documents: true } },
      },
      orderBy: { dateNotified: 'desc' },
    })
    res.json(ces)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/:projectId/compensation-events/:id', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    const ce = await prisma.compensationEvent.findUnique({
      where: { id: req.params.id },
      include: {
        notices: true,
        documents: true,
      },
    })
    if (!ce) { res.status(404).json({ message: 'CE not found' }); return }
    res.json(ce)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/:projectId/compensation-events',
  authenticate,
  requireProjectAccess,
  body('title').notEmpty().trim(),
  body('description').notEmpty().trim(),
  body('dateNotified').isISO8601(),
  async (req: AuthRequest, res): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    try {
      const count = await prisma.compensationEvent.count({ where: { projectId: req.params.projectId } })
      const ceNumber = `CE-${String(count + 1).padStart(3, '0')}`

      const { title, description, clauseRef, dateNotified, dateResponseDue, valuationAmount } = req.body
      const ce = await prisma.compensationEvent.create({
        data: {
          ceNumber,
          projectId: req.params.projectId,
          title,
          description,
          clauseRef: clauseRef || null,
          dateNotified: new Date(dateNotified),
          dateResponseDue: dateResponseDue ? new Date(dateResponseDue) : null,
          valuationAmount: valuationAmount ? Number(valuationAmount) : null,
          notifiedBy: req.user!.id,
        },
        include: { notices: true, documents: true, _count: { select: { notices: true, documents: true } } },
      })
      await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'CompensationEvent', entityId: ce.id, action: 'CREATE', ipAddress: req.ip })
      res.status(201).json(ce)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.put('/:projectId/compensation-events/:id',
  authenticate,
  requireProjectAccess,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const existing = await prisma.compensationEvent.findUnique({ where: { id: req.params.id } })
      if (!existing) { res.status(404).json({ message: 'CE not found' }); return }

      const { id, ceNumber, projectId, createdAt, updatedAt, notices, documents, notifiedBy, _count, ...updateData } = req.body
      if (updateData.dateNotified) updateData.dateNotified = new Date(updateData.dateNotified)
      if (updateData.dateResponseDue) updateData.dateResponseDue = new Date(updateData.dateResponseDue)
      if (updateData.valuationAmount) updateData.valuationAmount = Number(updateData.valuationAmount)

      const ce = await prisma.compensationEvent.update({
        where: { id: req.params.id },
        data: updateData,
        include: { notices: true, documents: true, _count: { select: { notices: true, documents: true } } },
      })

      const changes = diffObjects(existing as unknown as Record<string, unknown>, updateData)
      const action = existing.status !== ce.status ? 'STATUS_CHANGE' : 'UPDATE'
      await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'CompensationEvent', entityId: ce.id, action, changes, ipAddress: req.ip })
      res.json(ce)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.post('/:projectId/compensation-events/:id/documents',
  authenticate,
  requireProjectAccess,
  upload.single('file'),
  async (req: AuthRequest, res): Promise<void> => {
    if (!req.file) { res.status(400).json({ message: 'No file uploaded' }); return }
    try {
      const doc = await prisma.document.create({
        data: {
          ceId: req.params.id,
          name: req.file.originalname,
          path: req.file.filename,
          size: req.file.size,
          mimeType: req.file.mimetype,
          uploadedBy: req.user!.id,
        },
      })
      await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'Document', entityId: doc.id, action: 'CREATE', ipAddress: req.ip })
      res.status(201).json(doc)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.delete('/:projectId/compensation-events/:id', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    await prisma.compensationEvent.delete({ where: { id: req.params.id } })
    await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'CompensationEvent', entityId: req.params.id, action: 'DELETE', ipAddress: req.ip })
    res.status(204).send()
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
