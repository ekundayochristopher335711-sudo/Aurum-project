import express from 'express'
import bcrypt from 'bcryptjs'
import { body, validationResult } from 'express-validator'
import prisma from '../config/database'
import { authenticate, AuthRequest } from '../middleware/auth'
import { requireProjectAccess, requireRole } from '../middleware/roleCheck'
import { logAudit } from '../services/auditService'
import nodemailer from 'nodemailer'

const router = express.Router()

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

// ── Send invitation ───────────────────────────────────────────────────────────
router.post('/:projectId/invitations',
  authenticate,
  requireProjectAccess,
  requireRole('ADMIN', 'COMMERCIAL_MANAGER'),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['ADMIN', 'COMMERCIAL_MANAGER', 'VIEWER']),
  async (req: AuthRequest, res): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    const { email, role } = req.body
    const projectId = req.params.projectId

    try {
      const project = await prisma.project.findUnique({ where: { id: projectId } })
      if (!project) { res.status(404).json({ message: 'Project not found' }); return }

      // Check if user already a member
      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        const alreadyMember = await prisma.projectMember.findUnique({
          where: { userId_projectId: { userId: existingUser.id, projectId } },
        })
        if (alreadyMember) { res.status(409).json({ message: 'User is already a member of this project' }); return }
      }

      // Expire any previous pending invitations for this email+project
      await prisma.invitation.deleteMany({
        where: { email, projectId, acceptedAt: null },
      })

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      const invitation = await prisma.invitation.create({
        data: { email, projectId, role, expiresAt, invitedBy: req.user!.id },
      })

      const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/accept-invitation/${invitation.token}`
      const inviter = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { name: true } })

      // Send email if configured
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await transporter.sendMail({
          from: `"Aurum Project Controls" <${process.env.SMTP_USER}>`,
          to: email,
          subject: `You've been invited to ${project.name} — Aurum Project Controls`,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto">
              <div style="background:#080F1C;padding:24px 28px;border-radius:12px 12px 0 0;display:flex;align-items:center;gap:12px">
                <div>
                  <h2 style="color:#FFFFFF;margin:0;font-size:18px">Aurum Project Controls</h2>
                  <p style="color:#6EE7B7;margin:4px 0 0;font-size:12px">NEC Contract Workflow Engine</p>
                </div>
              </div>
              <div style="background:#fff;padding:32px 28px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px">
                <h3 style="color:#080F1C;font-size:20px;margin:0 0 8px">You're invited</h3>
                <p style="color:#6B7280;margin:0 0 24px;font-size:14px">
                  <strong>${inviter?.name ?? 'A team member'}</strong> has invited you to join
                  <strong>${project.name}</strong> as a <strong>${role.replace('_', ' ')}</strong>.
                </p>
                <a href="${inviteUrl}"
                   style="display:inline-block;background:linear-gradient(135deg,#6EE7B7,#FDE68A);color:#080F1C;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none">
                  Accept Invitation
                </a>
                <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0">
                  This invitation expires in 7 days. If you weren't expecting this, you can ignore this email.
                </p>
                <p style="color:#D1D5DB;font-size:11px;margin:8px 0 0">
                  Or copy this link: ${inviteUrl}
                </p>
              </div>
            </div>`,
        })
      }

      await logAudit({ userId: req.user!.id, projectId, entityType: 'Invitation', entityId: invitation.id, action: 'CREATE', ipAddress: req.ip })
      res.status(201).json({ message: `Invitation sent to ${email}`, token: invitation.token })
    } catch (e) {
      console.error(e)
      res.status(500).json({ message: 'Failed to send invitation' })
    }
  },
)

// ── Get pending invitations for a project ────────────────────────────────────
router.get('/:projectId/invitations',
  authenticate,
  requireProjectAccess,
  requireRole('ADMIN', 'COMMERCIAL_MANAGER'),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const invitations = await prisma.invitation.findMany({
        where: { projectId: req.params.projectId, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      })
      res.json(invitations)
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

// ── Accept invitation (public — no auth required) ────────────────────────────
router.get('/invitations/:token', async (req, res): Promise<void> => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token: req.params.token },
      include: { project: { select: { name: true, contractType: true } } },
    })
    if (!invitation) { res.status(404).json({ message: 'Invitation not found' }); return }
    if (invitation.acceptedAt) { res.status(410).json({ message: 'Invitation already accepted' }); return }
    if (invitation.expiresAt < new Date()) { res.status(410).json({ message: 'Invitation has expired' }); return }

    res.json({
      email: invitation.email,
      role: invitation.role,
      projectName: invitation.project.name,
      contractType: invitation.project.contractType,
    })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/invitations/:token/accept',
  body('name').notEmpty().trim(),
  body('password').isLength({ min: 8 }),
  async (req, res): Promise<void> => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return }

    try {
      const invitation = await prisma.invitation.findUnique({ where: { token: req.params.token } })
      if (!invitation) { res.status(404).json({ message: 'Invitation not found' }); return }
      if (invitation.acceptedAt) { res.status(410).json({ message: 'Already accepted' }); return }
      if (invitation.expiresAt < new Date()) { res.status(410).json({ message: 'Invitation expired' }); return }

      const { name, password } = req.body
      const hashed = await bcrypt.hash(password, 12)

      let user = await prisma.user.findUnique({ where: { email: invitation.email } })
      if (!user) {
        user = await prisma.user.create({
          data: { email: invitation.email, password: hashed, name, role: invitation.role },
        })
      }

      // Add to project
      await prisma.projectMember.upsert({
        where: { userId_projectId: { userId: user.id, projectId: invitation.projectId } },
        update: { role: invitation.role },
        create: { userId: user.id, projectId: invitation.projectId, role: invitation.role },
      })

      // Mark accepted
      await prisma.invitation.update({
        where: { token: req.params.token },
        data: { acceptedAt: new Date() },
      })

      res.json({ message: 'Account created successfully. You can now sign in.' })
    } catch (e) {
      console.error(e)
      res.status(500).json({ message: 'Failed to accept invitation' })
    }
  },
)

// ── Revoke invitation ─────────────────────────────────────────────────────────
router.delete('/:projectId/invitations/:id',
  authenticate,
  requireProjectAccess,
  requireRole('ADMIN'),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      await prisma.invitation.delete({ where: { id: req.params.id } })
      res.status(204).send()
    } catch {
      res.status(500).json({ message: 'Server error' })
    }
  },
)

export default router
