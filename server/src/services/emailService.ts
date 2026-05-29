import nodemailer from 'nodemailer'
import prisma from '../config/database'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendOverdueNotifications() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return

  const now = new Date()
  const overdueCEs = await prisma.compensationEvent.findMany({
    where: {
      status: { not: 'CLOSED' },
      dateResponseDue: { lt: now },
    },
    include: {
      project: { select: { name: true } },
    },
  })

  if (overdueCEs.length === 0) return

  const projects = await prisma.project.findMany({
    where: { id: { in: [...new Set(overdueCEs.map((ce) => ce.projectId))] } },
    include: { members: { include: { user: { select: { email: true, name: true } } } } },
  })

  for (const project of projects) {
    const projectCEs = overdueCEs.filter((ce) => ce.projectId === project.id)
    const recipients = project.members
      .filter((m) => m.role !== 'VIEWER')
      .map((m) => m.user.email)

    if (recipients.length === 0) continue

    const ceList = projectCEs
      .map((ce) => `  • ${ce.ceNumber}: ${ce.title} (due ${ce.dateResponseDue?.toLocaleDateString('en-GB')})`)
      .join('\n')

    await transporter.sendMail({
      from: `"Aurum Project Controls" <${process.env.SMTP_USER}>`,
      to: recipients.join(', '),
      subject: `[ACTION REQUIRED] ${projectCEs.length} overdue CE${projectCEs.length > 1 ? 's' : ''} — ${project.name}`,
      text: `Dear Team,\n\nThe following Compensation Events on ${project.name} are overdue for response:\n\n${ceList}\n\nPlease log in to Aurum Project Controls to take action.\n\nAurum Project Controls`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px">
          <div style="background:#0F172A;padding:20px 24px;border-radius:8px 8px 0 0">
            <h2 style="color:#D4AF37;margin:0">Aurum Project Controls</h2>
            <p style="color:#94A3B8;margin:4px 0 0">NEC Contract Workflow Engine</p>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 8px 8px">
            <h3 style="color:#0F172A">⚠️ Overdue Compensation Events — ${project.name}</h3>
            <p style="color:#475569">${projectCEs.length} CE${projectCEs.length > 1 ? 's require' : ' requires'} immediate attention:</p>
            <table style="width:100%;border-collapse:collapse">
              <tr style="background:#F8FAFC">
                <th style="padding:8px;text-align:left;border:1px solid #E2E8F0;font-size:12px">CE No.</th>
                <th style="padding:8px;text-align:left;border:1px solid #E2E8F0;font-size:12px">Title</th>
                <th style="padding:8px;text-align:left;border:1px solid #E2E8F0;font-size:12px">Due Date</th>
                <th style="padding:8px;text-align:left;border:1px solid #E2E8F0;font-size:12px">Status</th>
              </tr>
              ${projectCEs.map((ce) => `
                <tr>
                  <td style="padding:8px;border:1px solid #E2E8F0;font-size:12px;font-weight:bold">${ce.ceNumber}</td>
                  <td style="padding:8px;border:1px solid #E2E8F0;font-size:12px">${ce.title}</td>
                  <td style="padding:8px;border:1px solid #E2E8F0;font-size:12px;color:#DC2626">${ce.dateResponseDue?.toLocaleDateString('en-GB')}</td>
                  <td style="padding:8px;border:1px solid #E2E8F0;font-size:12px">${ce.status}</td>
                </tr>`).join('')}
            </table>
            <p style="margin-top:20px"><a href="${process.env.CLIENT_URL}" style="background:#B8860B;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">Open Aurum Project Controls</a></p>
          </div>
        </div>`,
    })
  }
}

export async function sendCEStatusChangeNotification(
  ceNumber: string,
  ceTitle: string,
  projectName: string,
  oldStatus: string,
  newStatus: string,
  changedBy: string,
  recipientEmails: string[],
) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || recipientEmails.length === 0) return

  await transporter.sendMail({
    from: `"Aurum Project Controls" <${process.env.SMTP_USER}>`,
    to: recipientEmails.join(', '),
    subject: `CE Status Update: ${ceNumber} → ${newStatus} — ${projectName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px">
        <div style="background:#0F172A;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#D4AF37;margin:0">Aurum Project Controls</h2>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 8px 8px">
          <h3>${ceNumber} status updated</h3>
          <p><strong>Project:</strong> ${projectName}</p>
          <p><strong>CE:</strong> ${ceTitle}</p>
          <p><strong>Status change:</strong> <span style="color:#64748B">${oldStatus}</span> → <span style="color:#16A34A;font-weight:bold">${newStatus}</span></p>
          <p><strong>Changed by:</strong> ${changedBy}</p>
        </div>
      </div>`,
  })
}
