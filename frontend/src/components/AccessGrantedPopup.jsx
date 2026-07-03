import React, { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { CheckCircle, Sparkles, X } from 'lucide-react'

/**
 * AccessGrantedPopup — Celebration popup shown when a viewer is promoted to admin.
 * Triggered on login if recently promoted, or in real-time via background polling.
 */
export default function AccessGrantedPopup() {
  const { accessGrantedPopup, acknowledgeAccessGranted, user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (accessGrantedPopup) {
      // Small delay to ensure the component is mounted before animating in
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
  }, [accessGrantedPopup])

  if (!accessGrantedPopup) return null

  const handleDismiss = () => {
    setExiting(true)
    setTimeout(() => {
      acknowledgeAccessGranted()
      setExiting(false)
      setVisible(false)
    }, 300)
  }

  return (
    <div className={`fixed inset-0 z-[99999] flex items-center justify-center transition-all duration-300 ${visible && !exiting ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Popup */}
      <div className={`relative max-w-lg w-full mx-4 transition-all duration-500 ${visible && !exiting ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
        {/* Glowing outer ring */}
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-white/20 via-zinc-400/10 to-white/20 blur-sm" />

        <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Top gradient bar */}
          <div className="h-1 bg-gradient-to-r from-zinc-650 via-white to-zinc-650" />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-all z-10"
          >
            <X size={18} />
          </button>

          <div className="p-8 pt-6 text-center">
            {/* Animated icon */}
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <CheckCircle size={36} className="text-white" />
                </div>
                {/* Floating sparkle */}
                <div className="absolute -top-1 -right-1 animate-bounce">
                  <Sparkles size={18} className="text-white" />
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white mb-2">
              Access Granted!
            </h2>

            {/* Subtitle */}
            <p className="text-base text-zinc-300 mb-1">
              Welcome aboard, <span className="font-semibold text-white">{user?.full_name}</span>
            </p>

            {/* Description */}
            <p className="text-sm text-zinc-400 leading-relaxed mb-6 max-w-sm mx-auto">
              An administrator has approved your request. You now have full access to create and edit documents, orders, and manifests.
            </p>

            {/* What's new section */}
            <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                What you can now do
              </p>
              <ul className="space-y-2">
                {[
                  'Create new customer orders',
                  'Edit manifest specifications & ledger',
                  'Revert orders to previous states',
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <CheckCircle size={14} className="text-white flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="w-full py-3 px-4 bg-gradient-to-r from-white to-zinc-200 hover:from-zinc-50 hover:to-zinc-300 text-zinc-950 font-semibold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-white/5 hover:shadow-white/10 active:scale-[0.98]"
            >
              Got it, let's go!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
