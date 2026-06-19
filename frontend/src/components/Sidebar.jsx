import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LayoutDashboard, Package, Users, BarChart3, LogOut, CheckSquare, ShieldAlert, Columns } from 'lucide-react'

export default function Sidebar({ isOpen: propIsOpen, setIsOpen: propSetIsOpen }) {
  const [localIsOpen, setLocalIsOpen] = useState(false)
  const isOpen = propIsOpen !== undefined ? propIsOpen : localIsOpen
  const setIsOpen = propSetIsOpen !== undefined ? propSetIsOpen : setLocalIsOpen

  const { logout, user, requestAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

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

  const iconSize = isOpen ? 18 : 22

  return (
    <>
      {/* Inline styles for the uniform electron border drawing animation with normalized pathLength */}
      <style>{`
        @keyframes border-draw {
          from {
            stroke-dashoffset: 100;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        .animate-border-draw {
          animation: border-draw 8s linear infinite;
        }
      `}</style>

      {/* Sidebar container */}
      <div
        className={`fixed left-0 top-[105px] h-[calc(100vh-105px)] bg-zinc-900 transition-all duration-300 z-40 flex flex-col justify-between md:sticky md:top-[105px]
          ${isOpen ? 'w-48' : 'w-0 overflow-hidden md:w-16 md:overflow-visible'}`}
      >
        <div className="pt-10 pb-4 px-2 flex flex-col gap-4">
          {/* Toggle Button (Columns Icon) - Positioned at the very top of the sidebar list */}
          <div className="relative group">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`w-full flex items-center rounded-xl transition-all duration-200 font-medium text-sm relative z-10
                ${isOpen ? 'px-3 py-2.5 gap-2.5 justify-start' : 'p-2.5 justify-center'}
                text-zinc-400 hover:text-zinc-200`}
            >
              {/* Electron border glow on hover */}
              <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0">
                <svg className="absolute inset-0 w-full h-full rounded-xl" overflow="visible">
                  <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    rx="12"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    pathLength="100"
                    strokeDasharray="30 70"
                    className="blur-[2px] opacity-30 animate-border-draw"
                  />
                  <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    rx="12"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                    pathLength="100"
                    strokeDasharray="30 70"
                    className="opacity-100 animate-border-draw"
                  />
                </svg>
              </div>

              <Columns size={iconSize} className="text-zinc-400 group-hover:text-zinc-200 z-10" />
              {isOpen && <span className="truncate z-10">Collapse</span>}
            </button>

            {/* Tooltip for collapsed state */}
            {!isOpen && (
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-900 border border-zinc-750 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                Expand Menu
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <nav>
            <ul className="space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <li key={item.path} className="relative group">
                    <button
                      onClick={() => {
                        navigate(item.path)
                        if (window.innerWidth < 768) setIsOpen(false)
                      }}
                      className={`w-full flex items-center rounded-xl transition-all duration-200 font-medium text-sm relative z-10
                        ${isOpen ? 'px-3 pt-2.5 pb-3.5 gap-2.5 justify-start' : 'pt-2.5 pb-3.5 px-2.5 justify-center'}
                        ${isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      {/* Electron border glow on hover */}
                      <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0">
                        <svg className="absolute inset-0 w-full h-full rounded-xl" overflow="visible">
                          <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            rx="12"
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="2"
                            pathLength="100"
                            strokeDasharray="30 70"
                            className="blur-[2px] opacity-30 animate-border-draw"
                          />
                          <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            rx="12"
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="1.2"
                            pathLength="100"
                            strokeDasharray="30 70"
                            className="opacity-100 animate-border-draw"
                          />
                        </svg>
                      </div>

                      {/* Subtle background highlight for active state when NOT hovered */}
                      {isActive && (
                        <div className="absolute inset-0 bg-white/5 rounded-xl -z-10 pointer-events-none" />
                      )}

                      <item.icon size={iconSize} className={`${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'} z-10`} />
                      {isOpen && <span className="truncate z-10">{item.label}</span>}

                      {/* Wobbly Underline for active state */}
                      {isActive && (
                        <svg
                          className={`absolute bottom-[3px] left-1/2 -translate-x-1/2 h-[8px] text-white pointer-events-none select-none transition-all duration-300 z-20 ${isOpen ? 'w-[70%]' : 'w-7'}`}
                          viewBox="0 0 100 16"
                          preserveAspectRatio="none"
                        >
                          <path
                            d="M3,9 Q25,3 50,11 T97,7"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            fill="none"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </button>

                    {/* Tooltip for collapsed state */}
                    {!isOpen && (
                      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-900 border border-zinc-750 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                        {item.label}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>

        {/* Bottom Panel */}
        <div className="flex flex-col gap-2">
          {/* Request Admin Access for Viewers (Only when open) */}
          {isOpen && user?.role === 'viewer' && (
            <div className="mx-2 my-1 p-3 bg-zinc-800/30 rounded-xl border border-zinc-800/80 animate-fadeIn">
              <p className="text-[11px] text-zinc-400 mb-1.5 leading-relaxed">
                You are in <strong className="text-zinc-200">Read-Only</strong>. Request admin access.
              </p>
              {user.requesting_admin ? (
                <div className="w-full text-center py-1.5 px-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] font-semibold text-amber-400 flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                  Pending
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
                  className="w-full py-1.5 px-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium text-[10px] rounded-lg transition-all shadow-md shadow-cyan-500/10 hover:shadow-cyan-500/20 active:scale-[0.98]"
                >
                  Request Admin
                </button>
              )}
            </div>
          )}

          {/* Request Admin Icon for Viewers (Only when collapsed) */}
          {!isOpen && user?.role === 'viewer' && (
            <div className="relative group px-2 mb-2">
              <button
                onClick={async () => {
                  if (user.requesting_admin) {
                    alert("Admin access request is currently pending approval.");
                    return;
                  }
                  const confirmReq = window.confirm("Would you like to request Admin write access?");
                  if (!confirmReq) return;
                  const res = await requestAdmin();
                  if (res.success) {
                    alert("Admin request submitted successfully!");
                  } else {
                    alert(res.error || "Failed to submit request.");
                  }
                }}
                className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all duration-200 font-medium relative z-10
                  ${user.requesting_admin 
                    ? 'text-amber-400' 
                    : 'text-zinc-500 hover:text-cyan-400'}`}
              >
                {/* Electron border glow on hover */}
                <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0">
                  <svg className="absolute inset-0 w-full h-full rounded-xl" overflow="visible">
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      rx="12"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2"
                      pathLength="100"
                      strokeDasharray="30 70"
                      className="blur-[2px] opacity-30 animate-border-draw"
                    />
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      rx="12"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.2"
                      pathLength="100"
                      strokeDasharray="30 70"
                      className="opacity-100 animate-border-draw"
                    />
                  </svg>
                </div>

                <ShieldAlert size={18} className={`${user.requesting_admin ? 'animate-pulse' : ''} z-10`} />
              </button>

              {/* Tooltip */}
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-900 border border-zinc-750 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                {user.requesting_admin ? "Admin Request Pending" : "Request Admin Access"}
              </div>
            </div>
          )}

          {/* Logout Button */}
          <div className="p-2 mb-4">
            <div className="relative group">
              <button
                onClick={handleLogout}
                className={`w-full flex items-center rounded-xl transition-all duration-200 font-medium text-sm relative z-10
                  ${isOpen ? 'px-3 py-2.5 gap-2.5 justify-start' : 'p-2.5 justify-center'}
                  text-zinc-400 hover:text-red-400`}
              >
                {/* Electron border glow on hover (red tinted for logout!) */}
                <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0">
                  <svg className="absolute inset-0 w-full h-full rounded-xl" overflow="visible">
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      rx="12"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      pathLength="100"
                      strokeDasharray="30 70"
                      className="blur-[2px] opacity-30 animate-border-draw"
                    />
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      rx="12"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="1.2"
                      pathLength="100"
                      strokeDasharray="30 70"
                      className="opacity-100 animate-border-draw"
                    />
                  </svg>
                </div>

                <LogOut size={iconSize} className="z-10" />
                {isOpen && <span className="z-10">Logout</span>}
              </button>

              {/* Tooltip for collapsed state */}
              {!isOpen && (
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-zinc-900 border border-zinc-750 text-red-400 text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                  Logout
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overlay when sidebar is open on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 md:hidden z-30 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
