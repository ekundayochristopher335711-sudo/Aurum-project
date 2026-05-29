import express from 'express'
import { body, validationResult } from 'express-validator'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requireRole, requireProjectAccess } from '../middleware/roleCheck'
import { logAudit } from '../services/auditService'

const router = express.Router()

router.get('/', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const where = req.user!.role === 'ADMIN'
      ? {}
      : { members: { some: { userId: req.user!.id } } }

    const projects = await prisma.project.findMany({
      where,
      include: {
        _count: {
          select: {
            earlyWarnings: true,
            compensationEvents: true,
            riskItems: true,
            notices: true,
          },
        },
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(projects)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/',
  authenticate,
  requireRole('ADMIN', 'COMMERCIAL_MANAGER'),
  body('name').notEmpty().trim(),
  async (req: AuthRequest, res): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    try {
      const { name, description, contractType, clientName, contractorName, startDate, endDate, contractValue } = req.body
      const project = await prisma.project.create({
        data: {
          name, description, contractType, clientName, contractorName,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          contractValue: contractValue ? Number(contractValue) : undefined,
          members: { create: { userId: req.user!.id, role: 'ADMIN' } },
        },
      })
      await logAudit({ userId: req.user!.id, projectId: project.id, entityType: 'Project', entityId: project.id, action: 'CREATE', ipAddress: req.ip })
      res.status(201).json(project)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.get('/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
        _count: {
          select: {
            earlyWarnings: true,
            compensationEvents: true,
            riskItems: true,
            notices: true,
          },
        },
      },
    })
    if (!project) { res.status(404).json({ message: 'Project not found' }); return }
    res.json(project)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.put('/:projectId',
  authenticate,
  requireProjectAccess,
  requireRole('ADMIN', 'COMMERCIAL_MANAGER'),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { id, members, _count, createdAt, updatedAt, ...updateData } = req.body
      if (updateData.startDate) updateData.startDate = new Date(updateData.startDate)
      if (updateData.endDate) updateData.endDate = new Date(updateData.endDate)
      const project = await prisma.project.update({ where: { id: req.params.projectId }, data: updateData })
      await logAudit({ userId: req.user!.id, projectId: project.id, entityType: 'Project', entityId: project.id, action: 'UPDATE', ipAddress: req.ip })
      res.json(project)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.post('/:projectId/members',
  authenticate,
  requireProjectAccess,
  requireRole('ADMIN'),
  async (req: AuthRequest, res): Promise<void> => {
    const { userId, role } = req.body
    try {
      const member = await prisma.projectMember.upsert({
        where: { userId_projectId: { userId, projectId: req.params.projectId } },
        update: { role },
        create: { userId, projectId: req.params.projectId, role },
      })
      res.status(201).json(member)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

export default router
