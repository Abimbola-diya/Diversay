import React, { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ShieldAlert, Lock, Loader2, CheckCircle, X } from 'lucide-react'

/**
 * AccessGatewayModal — Shown when a viewer attempts a create/edit action.
 * Offers them a clear path to request edit access from admin.
 */
export default function AccessGatewayModal({ isOpen, onClose }) {
  const { user, requestAdmin } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const alreadyPending = user?.requesting_admin

  const handleRequestAccess = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await requestAdmin()
      if (res.success) {
        setSubmitted(true)
      } else {
        setError(res.error || 'Failed to submit request.')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setSubmitted(false)
    setError('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-all z-10"
        >
          <X size={18} />
        </button>

        {/* Header gradient bar */}
        <div className="h-1 bg-gradient-to-r from-zinc-650 via-white to-zinc-650" />

        <div className="p-8 pt-6">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Lock size={28} className="text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-white text-center mb-2">
            Edit Access Required
          </h2>

          {/* Description */}
          <p className="text-sm text-zinc-400 text-center leading-relaxed mb-6">
            You're currently in <span className="text-zinc-200 font-semibold">read-only mode</span>. To create or edit documents, you'll need edit access granted by an administrator.
          </p>

          {/* Status / Action */}
          {alreadyPending || submitted ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2.5 px-5 py-3 bg-white/5 border border-white/10 rounded-xl w-full justify-center">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-sm font-semibold text-white">
                  Request Pending Admin Approval
                </span>
              </div>
              <p className="text-xs text-zinc-500 text-center leading-relaxed">
                Your request has been sent. You'll be notified the moment an administrator approves your access.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleRequestAccess}
                disabled={submitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-white to-zinc-200 hover:from-zinc-50 hover:to-zinc-300 text-zinc-950 font-semibold text-sm rounded-xl transition-all duration-200 shadow-lg shadow-white/5 hover:shadow-white/10 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending Request...
                  </>
                ) : (
                  <>
                    <ShieldAlert size={16} />
                    Request Edit Access
                  </>
                )}
              </button>

              {error && (
                <p className="text-xs text-red-400 text-center">{error}</p>
              )}
            </div>
          )}

          {/* Footer info */}
          <div className="mt-6 pt-5 border-t border-zinc-800/80">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={14} className="text-zinc-600 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                Edit access grants the ability to create orders, edit manifests, and manage documents. All actions are audited.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
