import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { logAudit } from '../services/auditService'

const router = express.Router()

router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').notEmpty().trim(),
  async (req, res): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    const { email, password, name, role } = req.body
    try {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) { res.status(409).json({ message: 'Email already registered' }); return }

      const hashed = await bcrypt.hash(password, 12)
      const user = await prisma.user.create({
        data: { email, password: hashed, name, role: role || 'VIEWER' },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      })

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' },
      )
      await logAudit({ userId: user.id, entityType: 'User', entityId: user.id, action: 'CREATE', ipAddress: req.ip })
      res.status(201).json({ user, token })
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    const { email, password } = req.body
    try {
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user || !user.isActive) { res.status(401).json({ message: 'Invalid credentials' }); return }

      const valid = await bcrypt.compare(password, user.password)
      if (!valid) { res.status(401).json({ message: 'Invalid credentials' }); return }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' },
      )
      res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token })
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

router.get('/me', authenticate, async (req: AuthRequest, res): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })
    res.json(user)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/users', authenticate, async (req: AuthRequest, res): Promise<void> => {
  if (req.user!.role !== 'ADMIN') { res.status(403).json({ message: 'Admin only' }); return }
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(users)
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
