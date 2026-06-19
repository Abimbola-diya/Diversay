import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Menu, X, LayoutDashboard, Package, Users, BarChart3, LogOut, CheckSquare } from 'lucide-react'

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true)
  const { logout, user, requestAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Orders', icon: Package, path: '/orders' },
    { label: 'Customers', icon: Users, path: '/customers' },
    { label: 'Products', icon: BarChart3, path: '/products' },
    user?.role === 'admin' && { label: 'Approvals', icon: CheckSquare, path: '/admin/approvals' }
  ].filter(Boolean)

  return (
    <>
      {/* Hamburger Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-4 top-4 z-50 p-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-800 transition-all duration-300 z-40 ${
        isOpen ? 'w-72' : 'w-0 overflow-hidden'
      }`}>
        {/* Logo / Title */}
        <div className="flex items-center gap-3 px-6 py-8 border-b border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <span className="text-white font-bold text-lg">DL</span>
          </div>
          {isOpen && <span className="font-bold text-white text-lg">Diversay</span>}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-6">
          <ul className="space-y-2 px-3">
            {navItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => {
                    navigate(item.path)
                    if (window.innerWidth < 768) setIsOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors font-medium"
                >
                  <item.icon size={20} />
                  {isOpen && <span>{item.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Request Admin Access for Viewers */}
        {isOpen && user?.role === 'viewer' && (
          <div className="mx-4 my-2 p-4 bg-slate-800/40 rounded-xl border border-slate-800/80">
            <p className="text-xs text-slate-400 mb-2 leading-relaxed">
              You are in <strong>Read-Only</strong> mode. Request admin access to edit and manage data.
            </p>
            {user.requesting_admin ? (
              <div className="w-full text-center py-2 px-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-semibold text-amber-400 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                Access Pending Approval
              </div>
            ) : (
              <button
                onClick={async () => {
                  const res = await requestAdmin();
                  if (res.success) {
                    alert("Admin request submitted successfully!");
                  } else {
                    alert(res.error || "Failed to submit request.");
                  }
                }}
                className="w-full py-2 px-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium text-xs rounded-lg transition-all shadow-md shadow-cyan-500/10 hover:shadow-cyan-500/20 active:scale-[0.98]"
              >
                Request Admin Access
              </button>
            )}
          </div>
        )}

        {/* Logout Button */}
        <div className="border-t border-slate-800 p-3 mb-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-900/20 hover:text-red-400 transition-colors font-medium"
          >
            <LogOut size={20} />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Overlay when sidebar is open on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
