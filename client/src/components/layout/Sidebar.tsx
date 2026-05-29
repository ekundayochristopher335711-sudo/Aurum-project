import { NavLink, useParams } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, AlertTriangle, ShieldAlert,
  FileText, Bell, ClipboardList, GitBranch, ChevronRight,
} from 'lucide-react'

function NavItem({ to, icon: Icon, label, end = false }: { to: string; icon: React.ElementType; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg mx-3 transition-all ${
          isActive
            ? 'bg-white/10 text-white'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-green' : ''}`} />
          <span>{label}</span>
          {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-green" />}
        </>
      )}
    </NavLink>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-6 pt-5 pb-1 text-xs font-semibold text-slate-600 uppercase tracking-widest">
      {children}
    </p>
  )
}

function ProjectNav({ projectId }: { projectId: string }) {
  const base = `/projects/${projectId}`
  const items = [
    { to: `${base}/dashboard`, icon: LayoutDashboard, label: 'Dashboard' },
    { to: `${base}/early-warnings`, icon: AlertTriangle, label: 'Early Warnings' },
    { to: `${base}/risks`, icon: ShieldAlert, label: 'Risk Register' },
    { to: `${base}/compensation-events`, icon: FileText, label: 'Comp. Events' },
    { to: `${base}/notices`, icon: Bell, label: 'Notices' },
    { to: `${base}/ce-whatif`, icon: GitBranch, label: 'CE What-If' },
    { to: `${base}/audit`, icon: ClipboardList, label: 'Audit Trail' },
  ]
  return (
    <>
      <SectionLabel>Project</SectionLabel>
      {items.map((item) => <NavItem key={item.to} {...item} />)}
    </>
  )
}

export default function Sidebar() {
  const { projectId } = useParams()

  return (
    <div className="w-56 bg-navy-900 flex flex-col shrink-0 border-r border-white/5">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Aurum" className="w-8 h-8 shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-none">Aurum</p>
            <p className="text-slate-500 text-xs mt-0.5 truncate">Project Controls</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto scrollbar-thin">
        <SectionLabel>Main</SectionLabel>
        <NavItem to="/projects" icon={FolderOpen} label="Projects" end />
        {projectId && <ProjectNav projectId={projectId} />}
      </nav>

      {/* Bottom tag */}
      <div className="px-5 py-4 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
          <span className="text-xs text-slate-500">NEC3 / NEC4</span>
        </div>
      </div>
    </div>
  )
}
