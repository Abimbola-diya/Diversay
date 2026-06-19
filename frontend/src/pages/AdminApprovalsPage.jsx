import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function AdminApprovalsPage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [pendingUsers, setPendingUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState(null)
  const [actionInProgress, setActionInProgress] = useState(false)

  useEffect(() => {
    // Redirect if not admin
    if (user && !isAdmin) {
      navigate('/orders')
      return
    }
    
    fetchPendingApprovals()
  }, [user, isAdmin])

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.get('/auth/admin/pending-approvals')
      setPendingUsers(response.data.pending_users || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch pending approvals')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId) => {
    try {
      setProcessingId(userId)
      setActionInProgress(true)
      await api.patch(`/auth/admin/approve-user/${userId}`)
      
      // Remove from list
      setPendingUsers(pendingUsers.filter(u => u.id !== userId))
      
      // Show success message
      alert('User approved successfully!')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to approve user')
    } finally {
      setProcessingId(null)
      setActionInProgress(false)
    }
  }

  const handleReject = async (userId) => {
    const reason = prompt('Provide a reason for rejection (optional):')
    if (reason === null) return // User clicked cancel
    
    try {
      setProcessingId(userId)
      setActionInProgress(true)
      await api.patch(`/auth/admin/reject-user/${userId}`, { reason })
      
      // Remove from list
      setPendingUsers(pendingUsers.filter(u => u.id !== userId))
      
      // Show success message
      alert('User rejected and removed.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reject user')
    } finally {
      setProcessingId(null)
      setActionInProgress(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
          <p className="text-zinc-400">Loading pending approvals...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 animate-fadeIn">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Requests</h1>
        <p className="text-zinc-400">
          Review and approve pending requests for admin write access
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-4 font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pending users list */}
      <div>
        {pendingUsers.length === 0 ? (
          <div className="bg-zinc-800 border border-zinc-700 rounded-lg shadow-md p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/15 rounded-full mb-4">
              <svg className="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-1">All Caught Up!</h3>
            <p className="text-zinc-400">
              No pending admin promotion requests at the moment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingUsers.map((pendingUser) => (
              <div
                key={pendingUser.id}
                className="bg-zinc-805/85 border border-zinc-700 rounded-lg shadow-md p-6 hover:border-zinc-600 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {pendingUser.full_name}
                    </h3>
                    <p className="text-sm text-zinc-400 mb-2">{pendingUser.email}</p>
                    <p className="text-xs text-zinc-500">
                      Signed up: {new Date(pendingUser.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-amber-500/15 text-amber-400 rounded-full text-sm font-medium">
                    Pending
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-4 border-t border-zinc-700">
                  <button
                    onClick={() => handleApprove(pendingUser.id)}
                    disabled={processingId === pendingUser.id || actionInProgress}
                    className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingId === pendingUser.id ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(pendingUser.id)}
                    disabled={processingId === pendingUser.id || actionInProgress}
                    className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingId === pendingUser.id ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {pendingUsers.length > 0 && (
        <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-300">
            <span className="font-semibold">{pendingUsers.length}</span> pending admin request{pendingUsers.length !== 1 ? 's' : ''} awaiting approval
          </p>
        </div>
      )}
    </div>
  )
}
