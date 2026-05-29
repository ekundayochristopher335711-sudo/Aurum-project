import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Upload, ChevronRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getCEs, createCE, updateCE, deleteCE, uploadDocument } from '../../api/compensationEvents'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import type { CompensationEvent } from '../../types'
import { useProjectRole } from '../../hooks/useProjectRole'
import { format, parseISO, differenceInDays } from 'date-fns'

const schema = z.object({
  title: z.string().min(1, 'Title required'),
  description: z.string().min(1, 'Description required'),
  dateNotified: z.string().min(1, 'Date required'),
  clauseRef: z.string().optional(),
  dateResponseDue: z.string().optional(),
  valuationAmount: z.string().optional(),
  status: z.enum(['NOTIFIED', 'QUOTED', 'ASSESSED', 'IMPLEMENTED', 'CLOSED']).optional(),
})
type FormData = z.infer<typeof schema>

const statusOptions = [
  { value: 'NOTIFIED', label: 'Notified' },
  { value: 'QUOTED', label: 'Quoted' },
  { value: 'ASSESSED', label: 'Assessed' },
  { value: 'IMPLEMENTED', label: 'Implemented' },
  { value: 'CLOSED', label: 'Closed' },
]

const NEC_WORKFLOW = ['NOTIFIED', 'QUOTED', 'ASSESSED', 'IMPLEMENTED', 'CLOSED']

function WorkflowProgress({ status }: { status: string }) {
  const idx = NEC_WORKFLOW.indexOf(status)
  return (
    <div className="flex items-center gap-0.5">
      {NEC_WORKFLOW.map((s, i) => (
        <div key={s} className="flex items-center gap-0.5">
          <div className={`h-1.5 w-8 rounded-full ${i <= idx ? 'bg-gold-500' : 'bg-slate-200'}`} />
          {i < NEC_WORKFLOW.length - 1 && <ChevronRight className="w-2 h-2 text-slate-300" />}
        </div>
      ))}
    </div>
  )
}

export default function CompensationEventsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const { canEdit } = useProjectRole()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CompensationEvent | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [uploadCeId, setUploadCeId] = useState<string | null>(null)

  const { data: ces = [], isLoading } = useQuery({
    queryKey: ['ces', projectId, statusFilter],
    queryFn: () => getCEs(projectId!, statusFilter || undefined),
    enabled: !!projectId,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { dateNotified: new Date().toISOString().split('T')[0] },
  })

  const openEdit = (ce: CompensationEvent) => {
    setEditing(ce)
    setValue('title', ce.title)
    setValue('description', ce.description)
    setValue('dateNotified', ce.dateNotified.split('T')[0])
    setValue('clauseRef', ce.clauseRef || '')
    setValue('dateResponseDue', ce.dateResponseDue ? ce.dateResponseDue.split('T')[0] : '')
    setValue('valuationAmount', ce.valuationAmount != null ? String(ce.valuationAmount) : '')
    setValue('status', ce.status)
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setEditing(null); reset({ dateNotified: new Date().toISOString().split('T')[0] }) }

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      editing ? updateCE(projectId!, editing.id, data) : createCE(projectId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ces', projectId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCE(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ces', projectId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] })
    },
  })

  const uploadMutation = useMutation({
    mutationFn: ({ ceId, file }: { ceId: string; file: File }) => uploadDocument(projectId!, ceId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ces', projectId] })
      setUploadCeId(null)
    },
  })

  const totalValue = ces.reduce((sum, ce) => sum + (ce.valuationAmount ?? 0), 0)

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Compensation Events</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {ces.length} event{ces.length !== 1 ? 's' : ''} · Total valuation: <span className="font-semibold text-gold-600">£{totalValue.toLocaleString('en-GB')}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gold-500"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {canEdit && <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setEditing(null); setModalOpen(true) }}>New CE</Button>}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : ces.length === 0 ? (
        <EmptyState title="No compensation events" description="Log compensation events following NEC clause 60 onwards." action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setModalOpen(true)}>New CE</Button>} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">CE No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Clause</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Notified</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Due</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Valuation</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Workflow</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Status</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ces.map((ce) => {
                const isOverdue = ce.dateResponseDue && new Date(ce.dateResponseDue) < new Date() && ce.status !== 'CLOSED'
                const daysLeft = ce.dateResponseDue ? differenceInDays(parseISO(ce.dateResponseDue), new Date()) : null
                return (
                  <tr key={ce.id} className={`hover:bg-slate-50 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-navy-900 bg-navy-50 px-2 py-0.5 rounded">{ce.ceNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{ce.title}</p>
                      <p className="text-xs text-slate-400 truncate max-w-xs">{ce.description}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{ce.clauseRef || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{format(parseISO(ce.dateNotified), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3 text-xs">
                      {ce.dateResponseDue ? (
                        <span className={isOverdue ? 'text-red-600 font-medium' : daysLeft !== null && daysLeft <= 7 ? 'text-amber-600' : 'text-slate-600'}>
                          {format(parseISO(ce.dateResponseDue), 'dd MMM yyyy')}
                          {isOverdue && <span className="block text-red-500">Overdue</span>}
                          {!isOverdue && daysLeft !== null && daysLeft <= 7 && <span className="block text-amber-500">{daysLeft}d left</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">
                      {ce.valuationAmount != null ? `£${ce.valuationAmount.toLocaleString('en-GB')}` : 'TBD'}
                    </td>
                    <td className="px-4 py-3"><WorkflowProgress status={ce.status} /></td>
                    <td className="px-4 py-3"><StatusBadge status={ce.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canEdit && <button onClick={() => { setUploadCeId(ce.id) }} title="Upload document" className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"><Upload className="w-4 h-4" /></button>}
                        {canEdit && <button onClick={() => openEdit(ce)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"><Pencil className="w-4 h-4" /></button>}
                        {canEdit && <button onClick={() => { if (confirm(`Delete ${ce.ceNumber}?`)) deleteMutation.mutate(ce.id) }} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? `Edit ${editing.ceNumber}` : 'New Compensation Event'} size="xl">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <Input label="Title *" placeholder="e.g. Client instruction to change scope at zone 2" error={errors.title?.message} {...register('title')} />
          <Textarea label="Description *" placeholder="Detailed description of the compensation event…" rows={4} error={errors.description?.message} {...register('description')} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="NEC Clause Reference" placeholder="60.1(1)" {...register('clauseRef')} />
            <Input label="Date Notified *" type="date" error={errors.dateNotified?.message} {...register('dateNotified')} />
            <Input label="Response Due Date" type="date" {...register('dateResponseDue')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valuation Amount (£)" type="number" placeholder="25000" {...register('valuationAmount')} />
            {editing && <Select label="Status" options={statusOptions} {...register('status')} />}
          </div>
          {mutation.error && <p className="text-sm text-red-600">Save failed. Please try again.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              {editing ? 'Save Changes' : 'Create CE'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!uploadCeId} onClose={() => setUploadCeId(null)} title="Upload Document" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Select a file to attach to this compensation event (max 10MB).</p>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gold-50 file:text-gold-700 hover:file:bg-gold-100"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file && uploadCeId) uploadMutation.mutate({ ceId: uploadCeId, file })
            }}
          />
          {uploadMutation.isPending && <p className="text-sm text-slate-400">Uploading…</p>}
          {uploadMutation.isSuccess && <p className="text-sm text-green-600">Upload successful.</p>}
        </div>
      </Modal>
    </div>
  )
}
