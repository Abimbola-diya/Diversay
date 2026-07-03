import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ShieldAlert, X, ArrowRight } from 'lucide-react'

/**
 * AccessRevokedPopup — Premium notification popup shown when a user's write/edit access is revoked.
 * Triggered in real-time via background polling.
 */
export default function AccessRevokedPopup() {
  const { accessRevokedPopup, acknowledgeAccessRevoked } = useAuth()
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (accessRevokedPopup) {
      // Small delay to ensure the component is mounted before animating in
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [accessRevokedPopup])

  if (!accessRevokedPopup) return null

  const handleDismiss = () => {
    setExiting(true)
    setTimeout(() => {
      acknowledgeAccessRevoked()
      setExiting(false)
      setVisible(false)
    }, 300)
  }

  return (
    <div className={`fixed inset-0 z-[99999] flex items-center justify-center transition-all duration-300 ${visible && !exiting ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Popup */}
      <div className={`relative max-w-md w-full mx-4 transition-all duration-500 ${visible && !exiting ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
        {/* Glowing outer ring */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-white/10 via-zinc-650/5 to-white/10 blur-sm" />

        <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-all z-10"
          >
            <X size={18} />
          </button>

          <div className="p-8 text-center flex flex-col items-center">
            {/* Animated icon */}
            <div className="flex justify-center mb-5 mt-2">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center animate-pulse">
                  <ShieldAlert size={28} className="text-red-400" />
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-white mb-2">
              Access Credentials Updated
            </h2>

            {/* Description */}
            <p className="text-sm text-zinc-400 leading-relaxed mb-6 max-w-xs text-center">
              Your write and edit permissions have been revoked by an administrator. Your account has been reverted to read-only access.
            </p>

            {/* Read-Only Status Info */}
            <div className="w-full bg-zinc-950/40 border border-zinc-800 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                What does this mean?
              </p>
              <div className="space-y-1.5 text-xs text-zinc-400">
                <p>• You can still view all orders, customers, and data directories</p>
                <p>• Creation of new orders and database mutations are disabled</p>
                <p>• You can request admin write privileges again if needed</p>
              </div>
            </div>

            {/* Acknowledge Button */}
            <button
              onClick={handleDismiss}
              className="w-full py-3 bg-white hover:bg-zinc-200 text-zinc-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 group shadow-lg shadow-white/5"
            >
              <span>Acknowledge</span>
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
