import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

import cron from 'node-cron'
import authRoutes from './routes/auth'
import projectRoutes from './routes/projects'
import earlyWarningRoutes from './routes/earlyWarnings'
import riskRoutes from './routes/risks'
import ceRoutes from './routes/compensationEvents'
import noticeRoutes from './routes/notices'
import dashboardRoutes from './routes/dashboard'
import reportRoutes from './routes/reports'
import excelRoutes from './routes/excel'
import invitationRoutes from './routes/invitations'
import { sendOverdueNotifications } from './services/emailService'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const uploadDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/uploads', express.static(uploadDir))

app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/projects', earlyWarningRoutes)
app.use('/api/projects', riskRoutes)
app.use('/api/projects', ceRoutes)
app.use('/api/projects', noticeRoutes)
app.use('/api/projects', dashboardRoutes)
app.use('/api/projects', reportRoutes)
app.use('/api/projects', excelRoutes)
app.use('/api/projects', invitationRoutes)
app.use('/api/invitations', invitationRoutes)

// Daily 08:00 check for overdue CEs — sends email alerts
cron.schedule('0 8 * * *', () => {
  sendOverdueNotifications().catch(console.error)
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Aurum Project Controls API — port ${PORT}`)
})

export default app
