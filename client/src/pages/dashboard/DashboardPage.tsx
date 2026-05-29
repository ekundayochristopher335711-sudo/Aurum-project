import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, ShieldAlert, FileText, Clock, TrendingUp, Download, FileSpreadsheet,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend,
} from 'recharts'
import { getDashboard, downloadReport, downloadExcel } from '../../api/dashboard'
import { getCEs } from '../../api/compensationEvents'
import { KPICard } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { format, parseISO, subDays } from 'date-fns'

const CE_COLORS: Record<string, string> = {
  NOTIFIED: '#3B82F6',
  QUOTED: '#D4AF37',
  ASSESSED: '#F59E0B',
  IMPLEMENTED: '#10B981',
  CLOSED: '#94A3B8',
}

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => getDashboard(projectId!),
    enabled: !!projectId,
    refetchInterval: 30000,
  })

  const { data: ces = [] } = useQuery({
    queryKey: ['ces', projectId],
    queryFn: () => getCEs(projectId!),
    enabled: !!projectId,
  })

  if (isLoading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading dashboard…</div>
  if (!data) return null

  // Build CE cumulative value timeline (last 90 days)
  const ceTimeline = (() => {
    const days = 30
    return Array.from({ length: days }, (_, i) => {
      const date = subDays(new Date(), days - 1 - i)
      const dateStr = format(date, 'dd MMM')
      const cumValue = ces
        .filter((ce) => new Date(ce.dateNotified) <= date)
        .reduce((s, ce) => s + (ce.valuationAmount ?? 0), 0)
      return { date: dateStr, value: cumValue }
    })
  })()

  // Financial forecast: current assessed vs what-if all accepted
  const financialData = [
    { name: 'Notified', value: ces.filter((c) => c.status === 'NOTIFIED').reduce((s, c) => s + (c.valuationAmount ?? 0), 0) },
    { name: 'Quoted', value: ces.filter((c) => c.status === 'QUOTED').reduce((s, c) => s + (c.valuationAmount ?? 0), 0) },
    { name: 'Assessed', value: ces.filter((c) => c.status === 'ASSESSED').reduce((s, c) => s + (c.valuationAmount ?? 0), 0) },
    { name: 'Implemented', value: ces.filter((c) => c.status === 'IMPLEMENTED').reduce((s, c) => s + (c.valuationAmount ?? 0), 0) },
    { name: 'Closed', value: ces.filter((c) => c.status === 'CLOSED').reduce((s, c) => s + (c.valuationAmount ?? 0), 0) },
  ]

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Commercial Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time project performance overview</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />} onClick={() => downloadReport(projectId!, 'commercial')}>
            PDF Report
          </Button>
          <Button variant="outline" size="sm" icon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => downloadExcel(projectId!, 'ces')}>
            CE Excel
          </Button>
          <Button variant="outline" size="sm" icon={<FileSpreadsheet className="w-4 h-4" />} onClick={() => downloadExcel(projectId!, 'risks')}>
            Risk Excel
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Open Early Warnings" value={data.kpis.openEWs} color="red" icon={<AlertTriangle className="w-5 h-5" />} />
        <KPICard label="Open Risks" value={data.kpis.openRisks} color="red" icon={<ShieldAlert className="w-5 h-5" />} />
        <KPICard label="Open CEs" value={data.kpis.openCEs} color="gold" icon={<FileText className="w-5 h-5" />} />
        <KPICard label="Overdue CEs" value={data.kpis.overdueCEs} color={data.kpis.overdueCEs > 0 ? 'red' : 'green'} icon={<Clock className="w-5 h-5" />} />
        <KPICard
          label="Total CE Value"
          value={`£${(data.kpis.totalCEValue / 1000).toFixed(0)}k`}
          color="blue"
          icon={<TrendingUp className="w-5 h-5" />}
          sub={`£${data.kpis.totalCEValue.toLocaleString('en-GB')}`}
        />
        <KPICard
          label="Risk Exposure"
          value={`£${(data.kpis.riskExposure / 1000).toFixed(0)}k`}
          color={data.kpis.riskExposure > 50000 ? 'red' : 'slate'}
          sub={`£${data.kpis.riskExposure.toLocaleString('en-GB')}`}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Cumulative CE Value (last 30 days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={ceTimeline}>
              <defs>
                <linearGradient id="ceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#B8860B" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#B8860B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`£${v.toLocaleString('en-GB')}`, 'CE Value']} />
              <Area type="monotone" dataKey="value" stroke="#B8860B" strokeWidth={2} fill="url(#ceGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">CE Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.cesByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={75} innerRadius={35}>
                {data.cesByStatus.map((entry) => (
                  <Cell key={entry.status} fill={CE_COLORS[entry.status] || '#94A3B8'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">CE Value by Status (£)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={financialData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `£${v.toLocaleString('en-GB')}`} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {financialData.map((entry) => (
                  <Cell key={entry.name} fill={CE_COLORS[entry.name.toUpperCase()] || '#94A3B8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Early Warning Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.ewsByStatus} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#B8860B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Recent Activity</h3>
          <span className="text-xs text-slate-400">Auto-refreshes every 30 seconds</span>
        </div>
        <div className="divide-y divide-slate-50">
          {data.recentActivity.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No activity yet.</p>
          ) : (
            data.recentActivity.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gold-100 flex items-center justify-center text-xs font-semibold text-gold-700">
                    {a.userName.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{a.userName}</span>{' '}
                    <span className="text-slate-400">{a.action.toLowerCase().replace('_', ' ')}</span>{' '}
                    <span className="font-medium text-slate-600">{a.entityType}</span>
                  </p>
                </div>
                <span className="text-xs text-slate-400">{format(parseISO(a.createdAt), 'dd MMM, HH:mm')}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
