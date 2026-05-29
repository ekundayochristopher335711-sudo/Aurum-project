import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-6 max-w-screen-2xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
