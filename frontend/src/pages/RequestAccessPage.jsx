import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { ShieldAlert, Users, Loader2, CheckCircle, ArrowLeft, Send } from 'lucide-react'

export default function RequestAccessPage() {
  const { user, requestAdmin } = useAuth()
  const navigate = useNavigate()
  const [admins, setAdmins] = useState([])
  const [loadingAdmins, setLoadingAdmins] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [selectedAdminId, setSelectedAdminId] = useState(null)

  const selectedAdmin = admins.find(a => a.id === selectedAdminId)

  useEffect(() => {
    fetchAdmins()
  }, [])

  const fetchAdmins = async () => {
    try {
      setLoadingAdmins(true)
      const response = await api.get('/auth/admins')
      setAdmins(response.data || [])
    } catch (err) {
      console.error('Failed to fetch admin list:', err)
    } finally {
      setLoadingAdmins(false)
    }
  }

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

  const alreadyPending = user?.requesting_admin || submitted

  return (
    <div className="max-w-xl mx-auto py-12 px-4 animate-fadeIn">
      {/* Back to Orders */}
      <button
        onClick={() => navigate('/orders')}
        className="mb-8 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      {/* Main Card */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Top gradient bar: transitioned white */}
        <div className="h-1 bg-gradient-to-r from-zinc-650 via-white to-zinc-650" />

        <div className="p-8 md:p-10">
          {/* Header */}
          <div className="mb-8 text-center md:text-left">
            <h1 className="text-3xl font-extrabold text-white mb-3 flex items-center justify-center md:justify-start gap-3">
              <ShieldAlert className="text-zinc-400" size={32} />
              Access Elevation
            </h1>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Submit a formal request to system administrators to grant create, edit, and document manipulation privileges for your account.
            </p>
          </div>

          {/* Admin Directory Section */}
          <div className="bg-zinc-950/40 border border-zinc-850 rounded-2xl p-5 mb-8">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users size={14} />
              Active System Administrators
            </h3>

            {loadingAdmins ? (
              <div className="py-4 text-center text-zinc-500 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-zinc-400" />
                <span className="text-xs">Locating administrators...</span>
              </div>
            ) : admins.length === 0 ? (
              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
                <p className="text-xs text-zinc-400">No active system administrators found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    onClick={() => setSelectedAdminId(selectedAdminId === admin.id ? null : admin.id)}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                      selectedAdminId === admin.id
                        ? 'bg-white/5 border-white shadow-lg shadow-white/5'
                        : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700/80'
                    }`}
                  >
                    {/* Radio Indicator */}
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                      selectedAdminId === admin.id ? 'border-white bg-white' : 'border-zinc-700 bg-transparent'
                    }`}>
                      {selectedAdminId === admin.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="font-bold text-white text-sm">{admin.full_name}</div>
                      <div className="text-xs text-zinc-500 font-mono mt-0.5">{admin.email}</div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 border border-zinc-750 text-zinc-400">
                      System Admin
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action / Status Panel */}
          {alreadyPending ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-5 py-4 bg-white/5 border border-white/10 rounded-2xl justify-center text-center animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  Request Pending Approval
                </span>
              </div>
              <p className="text-xs text-zinc-500 text-center leading-relaxed max-w-sm mx-auto">
                Your request has been filed. Active administrators will review and approve your write permissions. You will receive an alert inside the app immediately upon approval.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={handleRequestAccess}
                disabled={!selectedAdminId || submitting}
                className="w-full py-4 px-6 bg-gradient-to-r from-white to-zinc-200 hover:from-zinc-50 hover:to-zinc-300 text-zinc-950 font-bold text-sm rounded-2xl transition-all duration-200 shadow-xl shadow-white/5 hover:shadow-white/10 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center gap-2.5"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-zinc-950" />
                    Filing Access Request...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    {selectedAdmin ? `Request Access from ${selectedAdmin.full_name}` : 'Select Administrator to Request Access'}
                  </>
                )}
              </button>

              {error && (
                <p className="text-xs text-red-400 text-center font-medium mt-2">{error}</p>
              )}
            </div>
          )}

          {/* Guidelines */}
          <div className="mt-8 pt-6 border-t border-zinc-850">
            <div className="flex items-start gap-3">
              <ShieldAlert size={16} className="text-zinc-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 mb-1">Access Guidelines</h4>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Elevated permissions enable document creation and manifest management. All operations, modifications, and access times are logged for regulatory audit trails.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
