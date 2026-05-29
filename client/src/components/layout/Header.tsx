import { useNavigate } from 'react-router-dom'
import { LogOut, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const roleLabelMap: Record<string, string> = {
  ADMIN: 'Admin',
  COMMERCIAL_MANAGER: 'Commercial Manager',
  VIEWER: 'Viewer',
}

export default function Header() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-13 bg-white border-b border-slate-100 flex items-center justify-end px-6 shrink-0 gap-3">
      {user && (
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-800 leading-none">{user.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{roleLabelMap[user.role] ?? user.role}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-green to-brand-yellow flex items-center justify-center text-navy-900 font-bold text-sm shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="ml-1 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  )
}
