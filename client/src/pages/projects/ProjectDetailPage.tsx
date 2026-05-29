import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ShieldAlert, FileText, Bell, ClipboardList, LayoutDashboard, UserPlus, GitBranch, Trash2, Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getProject } from '../../api/projects'
import { sendInvitation, getInvitations, revokeInvitation } from '../../api/invitations'
import { useAuthStore } from '../../store/authStore'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { format, parseISO } from 'date-fns'

const inviteSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['ADMIN', 'COMMERCIAL_MANAGER', 'VIEWER']),
})
type InviteForm = z.infer<typeof inviteSchema>

const roleColors: Record<string, string> = {
  ADMIN: 'bg-gold-100 text-gold-700',
  COMMERCIAL_MANAGER: 'bg-blue-100 text-blue-700',
  VIEWER: 'bg-slate-100 text-slate-600',
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,
  })

  const { data: pendingInvites = [] } = useQuery({
    queryKey: ['invitations', projectId],
    queryFn: () => getInvitations(projectId!),
    enabled: !!projectId && (user?.role === 'ADMIN' || user?.role === 'COMMERCIAL_MANAGER'),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'VIEWER' },
  })

  const inviteMutation = useMutation({
    mutationFn: (data: InviteForm) => sendInvitation(projectId!, data.email, data.role),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['invitations', projectId] })
      setInviteSuccess(`Invitation sent to ${vars.email}`)
      reset()
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeInvitation(projectId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations', projectId] }),
  })

  const canInvite = user?.role === 'ADMIN' || user?.role === 'COMMERCIAL_MANAGER'

  if (isLoading) return <div className="text-slate-400 py-12 text-center">Loading…</div>
  if (!project) return null

  const modules = [
    { label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard', count: null, color: 'bg-navy-900 text-white' },
    { label: 'Early Warnings', icon: AlertTriangle, path: 'early-warnings', count: project._count?.earlyWarnings, color: 'bg-red-50 text-red-500' },
    { label: 'Risk Register', icon: ShieldAlert, path: 'risks', count: project._count?.riskItems, color: 'bg-amber-50 text-amber-600' },
    { label: 'Compensation Events', icon: FileText, path: 'compensation-events', count: project._count?.compensationEvents, color: 'bg-blue-50 text-blue-600' },
    { label: 'Notices', icon: Bell, path: 'notices', count: project._count?.notices, color: 'bg-violet-50 text-violet-600' },
    { label: 'CE What-If', icon: GitBranch, path: 'ce-whatif', count: null, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Audit Trail', icon: ClipboardList, path: 'audit', count: null, color: 'bg-slate-100 text-slate-500' },
  ]

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
            <span className="cursor-pointer hover:text-gold-600 transition-colors" onClick={() => navigate('/projects')}>Projects</span>
            <span>/</span>
            <span className="text-slate-700 font-medium">{project.name}</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">{project.name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${project.contractType === 'NEC4' ? 'bg-gold-100 text-gold-700' : 'bg-blue-100 text-blue-700'}`}>
              {project.contractType}
            </span>
            {project.clientName && <span className="text-sm text-slate-500">Client: <span className="font-medium text-slate-700">{project.clientName}</span></span>}
            {project.contractValue && <span className="text-sm text-slate-500">Value: <span className="font-medium text-slate-700">£{project.contractValue.toLocaleString('en-GB')}</span></span>}
          </div>
        </div>
        {canInvite && (
          <Button icon={<UserPlus className="w-4 h-4" />} onClick={() => { setInviteOpen(true); setInviteSuccess('') }}>
            Invite Member
          </Button>
        )}
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {modules.map(({ label, icon: Icon, path, count, color }) => (
          <button
            key={path}
            onClick={() => navigate(`/projects/${projectId}/${path}`)}
            className="bg-white rounded-xl border border-slate-200 shadow-card p-5 text-left hover:shadow-card-md hover:border-slate-300 transition-all group"
          >
            <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="font-medium text-slate-800 text-sm">{label}</p>
            {count !== null && count !== undefined && (
              <p className="text-2xl font-semibold text-gold-600 mt-1 tracking-tight">{count}</p>
            )}
          </button>
        ))}
      </div>

      {/* Team members */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Team Members</h3>
          <span className="text-xs text-slate-400">{project.members?.length ?? 0} members</span>
        </div>
        <div className="divide-y divide-slate-50">
          {project.members?.map((m) => (
            <div key={m.id} className="px-5 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center text-navy-900 font-bold text-sm shrink-0">
                {m.user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{m.user.name}</p>
                <p className="text-xs text-slate-400 truncate">{m.user.email}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${roleColors[m.role] ?? 'bg-slate-100 text-slate-600'}`}>
                {m.role.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>

        {/* Pending invitations */}
        {pendingInvites.length > 0 && (
          <>
            <div className="px-5 py-3 border-t border-slate-100 border-dashed">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Invitations</p>
            </div>
            {(pendingInvites as { id: string; email: string; role: string; expiresAt: string }[]).map((inv) => (
              <div key={inv.id} className="px-5 py-3 flex items-center gap-3 border-t border-dashed border-slate-100 bg-slate-50/50">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-600">{inv.email}</p>
                  <p className="text-xs text-slate-400">Expires {format(parseISO(inv.expiresAt), 'dd MMM yyyy')}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${roleColors[inv.role] ?? 'bg-slate-100 text-slate-600'}`}>
                  {inv.role.replace('_', ' ')}
                </span>
                <button onClick={() => revokeMutation.mutate(inv.id)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Team Member" size="sm">
        <form onSubmit={handleSubmit((d) => inviteMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <input
              type="email"
              placeholder="colleague@company.com"
              className={`w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand-green/40 ${errors.email ? 'border-red-400' : 'border-slate-200'}`}
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <select className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green/40" {...register('role')}>
              <option value="VIEWER">Viewer — read only</option>
              <option value="COMMERCIAL_MANAGER">Commercial Manager — can create & edit</option>
              <option value="ADMIN">Admin — full access</option>
            </select>
          </div>

          {inviteSuccess && <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{inviteSuccess}</p>}
          {inviteMutation.isError && <p className="text-sm text-red-600">Failed to send invitation. Please try again.</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button type="submit" icon={<Mail className="w-4 h-4" />} loading={isSubmitting || inviteMutation.isPending}>
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
