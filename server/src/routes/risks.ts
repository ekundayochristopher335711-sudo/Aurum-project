import express from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requireProjectAccess } from '../middleware/roleCheck'
import { logAudit, diffObjects } from '../services/auditService'

const router = express.Router()

router.get('/:projectId/risks', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { status } = req.query
    const risks = await prisma.riskItem.findMany({
      where: {
        projectId: req.params.projectId,
        ...(status ? { status: status as 'OPEN' | 'MITIGATED' | 'CLOSED' } : {}),
      },
      include: { earlyWarning: { select: { id: true, ewNumber: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(risks)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/:projectId/risks/:id', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    const risk = await prisma.riskItem.findUnique({
      where: { id: req.params.id },
      include: { earlyWarning: true },
    })
    if (!risk) { res.status(404).json({ message: 'Risk not found' }); return }
    res.json(risk)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/:projectId/risks',
  authenticate,
  requireProjectAccess,
  body('description').notEmpty().trim(),
  body('probability').isInt({ min: 1, max: 5 }),
  async (req: AuthRequest, res): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    try {
      const count = await prisma.riskItem.count({ where: { projectId: req.params.projectId } })
      const riskId = `R-${String(count + 1).padStart(3, '0')}`

      const { description, probability, costImpact, timeImpact, mitigation, owner, earlyWarningId } = req.body
      const risk = await prisma.riskItem.create({
        data: {
          riskId,
          projectId: req.params.projectId,
          description,
          probability: Number(probability),
          costImpact: costImpact ? Number(costImpact) : null,
          timeImpact: timeImpact ? Number(timeImpact) : null,
          mitigation: mitigation || null,
          owner: owner || null,
          earlyWarningId: earlyWarningId || null,
        },
        include: { earlyWarning: { select: { id: true, ewNumber: true, title: true } } },
      })
      await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'RiskItem', entityId: risk.id, action: 'CREATE', ipAddress: req.ip })
      res.status(201).json(risk)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.put('/:projectId/risks/:id',
  authenticate,
  requireProjectAccess,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const existing = await prisma.riskItem.findUnique({ where: { id: req.params.id } })
      if (!existing) { res.status(404).json({ message: 'Risk not found' }); return }

      const { id, riskId, projectId, createdAt, updatedAt, earlyWarning, ...updateData } = req.body
      if (updateData.probability) updateData.probability = Number(updateData.probability)
      if (updateData.costImpact) updateData.costImpact = Number(updateData.costImpact)
      if (updateData.timeImpact) updateData.timeImpact = Number(updateData.timeImpact)

      const risk = await prisma.riskItem.update({
        where: { id: req.params.id },
        data: updateData,
        include: { earlyWarning: { select: { id: true, ewNumber: true, title: true } } },
      })

      const changes = diffObjects(existing as unknown as Record<string, unknown>, updateData)
      const action = existing.status !== risk.status ? 'STATUS_CHANGE' : 'UPDATE'
      await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'RiskItem', entityId: risk.id, action, changes, ipAddress: req.ip })
      res.json(risk)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.delete('/:projectId/risks/:id', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    await prisma.riskItem.delete({ where: { id: req.params.id } })
    await logAudit({ userId: req.user!.id, projectId: req.params.projectId, entityType: 'RiskItem', entityId: req.params.id, action: 'DELETE', ipAddress: req.ip })
    res.status(204).send()
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
