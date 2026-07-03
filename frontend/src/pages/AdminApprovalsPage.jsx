import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { 
  Shield, 
  ShieldAlert, 
  UserMinus, 
  UserCheck, 
  Search, 
  Users, 
  ShieldCheck, 
  Mail, 
  Calendar,
  Edit3
} from 'lucide-react'

export default function AdminApprovalsPage() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('requests') // 'requests' | 'users'
  const [pendingUsers, setPendingUsers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [error, setError] = useState('')
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [processingId, setProcessingId] = useState(null)
  const [actionInProgress, setActionInProgress] = useState(false)

  useEffect(() => {
    // Redirect if not admin
    if (user && !isAdmin) {
      navigate('/orders')
      return
    }
    
    fetchPendingApprovals()
    fetchAllUsers()
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

  const fetchAllUsers = async () => {
    try {
      setLoadingUsers(true)
      setError('')
      const response = await api.get('/auth/admin/users')
      setAllUsers(response.data || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch user directory')
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleApprove = async (userId) => {
    try {
      setProcessingId(userId)
      setActionInProgress(true)
      await api.patch(`/auth/admin/approve-user/${userId}`)
      
      // Remove from pending list
      setPendingUsers(pendingUsers.filter(u => u.id !== userId))
      
      // Update in allUsers list if loaded. They remain 'viewer' but with has_write_access: true!
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, role: 'viewer', has_write_access: true, requesting_admin: false } : u))
      
      alert('User approved and granted edit permissions successfully!')
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
      
      // Remove from pending list
      setPendingUsers(pendingUsers.filter(u => u.id !== userId))
      
      // Update in allUsers list if loaded
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, requesting_admin: false } : u))
      
      alert('User request rejected and removed.')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reject user')
    } finally {
      setProcessingId(null)
      setActionInProgress(false)
    }
  }

  const handleUpdateRole = async (userId, newRole) => {
    const confirmMessage = newRole === 'viewer' 
      ? "Are you sure you want to revoke this user's admin access? They will be demoted to a viewer."
      : "Are you sure you want to grant this user admin access? They will have full administrative access.";
      
    if (!window.confirm(confirmMessage)) return
    
    try {
      setProcessingId(userId)
      setActionInProgress(true)
      const res = await api.patch(`/auth/admin/users/${userId}/role`, { role: newRole })
      
      // Update locally
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, role: newRole, has_write_access: res.data.has_write_access, requesting_admin: false } : u))
      setPendingUsers(pendingUsers.filter(u => u.id !== userId))
      
      alert(`User role updated to ${newRole} successfully!`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update user role')
    } finally {
      setProcessingId(null)
      setActionInProgress(false)
    }
  }

  const handleUpdateWriteAccess = async (userId, hasAccess) => {
    const confirmMessage = hasAccess
      ? "Are you sure you want to grant this user edit and create access?"
      : "Are you sure you want to revoke this user's edit and create access? They will return to read-only status.";
      
    if (!window.confirm(confirmMessage)) return
    
    try {
      setProcessingId(userId)
      setActionInProgress(true)
      await api.patch(`/auth/admin/users/${userId}/role`, { role: 'viewer', has_write_access: hasAccess })
      
      // Update locally
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, role: 'viewer', has_write_access: hasAccess, requesting_admin: false } : u))
      setPendingUsers(pendingUsers.filter(u => u.id !== userId))
      
      alert(`User permissions updated successfully!`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update user permissions')
    } finally {
      setProcessingId(null)
      setActionInProgress(false)
    }
  }

  // Filter all users based on query
  const filteredUsers = allUsers.filter(u => 
    u.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  )

  const approvedViewers = allUsers.filter(u => u.role === 'viewer' && u.has_write_access)

  if (loading && pendingUsers.length === 0 && allUsers.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
          <p className="text-zinc-400">Loading directory services...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8 animate-fadeIn flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
            <Shield className="text-white" size={32} strokeWidth={2} />
            Access Governance
          </h1>
          <p className="text-zinc-400">
            Control credentials, elevate permissions, and manage user roles
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'requests'
              ? 'border-white text-white bg-white/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
          }`}
        >
          <ShieldAlert size={16} />
          Pending Requests
          {pendingUsers.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-400 rounded-full">
              {pendingUsers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-white text-white bg-white/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
          }`}
        >
          <Users size={16} />
          User Directory
          {allUsers.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 text-xs font-semibold bg-zinc-800 text-zinc-400 rounded-full">
              {allUsers.length}
            </span>
          )}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex justify-between items-center animate-in slide-in-from-top-4">
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="font-semibold hover:underline text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Contents */}
      {activeTab === 'requests' ? (
        <div>
          {pendingUsers.length === 0 ? (
            approvedViewers.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center shadow-xl">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl mb-4">
                  <ShieldCheck className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Queue Empty</h3>
                <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed">
                  There are currently no users requesting admin status or edit elevation.
                </p>
              </div>
            ) : (
              <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4 text-center text-zinc-400 text-sm mb-6 flex items-center justify-center gap-2">
                <ShieldCheck className="text-emerald-500" size={16} />
                <span>All pending requests have been approved or resolved.</span>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingUsers.map((pendingUser) => (
                <div
                  key={pendingUser.id}
                  className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 hover:border-zinc-700/80 transition-all shadow-lg flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-0.5">
                          {pendingUser.full_name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                          <Mail size={12} className="text-zinc-500" />
                          {pendingUser.email}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-bold animate-pulse">
                        PENDING
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-2">
                      <Calendar size={12} />
                      Joined: {new Date(pendingUser.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-5 mt-5 border-t border-zinc-800/60">
                    <button
                      onClick={() => handleApprove(pendingUser.id)}
                      disabled={processingId === pendingUser.id || actionInProgress}
                      className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition shadow-lg shadow-green-600/15 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <UserCheck size={14} />
                      {processingId === pendingUser.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(pendingUser.id)}
                      disabled={processingId === pendingUser.id || actionInProgress}
                      className="flex-1 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold rounded-xl border border-zinc-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <UserMinus size={14} />
                      {processingId === pendingUser.id ? 'Rejecting...' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Edit Access Section */}
          <div className="mt-12 pt-8 border-t border-zinc-800">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Users className="text-zinc-400" size={20} />
              Active Edit Access (Viewers)
            </h2>
            <p className="text-zinc-500 text-xs mb-6">
              Viewers who have been granted temporary or permanent edit access
            </p>

            {approvedViewers.length === 0 ? (
              <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-8 text-center text-zinc-500 text-sm">
                No viewers currently have edit access.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {approvedViewers.map((approvedUser) => (
                  <div
                    key={approvedUser.id}
                    className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 hover:border-zinc-700/80 transition-all shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-0.5">
                            {approvedUser.full_name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                            <Mail size={12} className="text-zinc-500" />
                            {approvedUser.email}
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold">
                          EDIT ACCESS
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-2">
                        <Calendar size={12} />
                        Joined: {new Date(approvedUser.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Revoke Action */}
                    <div className="pt-5 mt-5 border-t border-zinc-800/60">
                      <button
                        onClick={() => handleUpdateWriteAccess(approvedUser.id, false)}
                        disabled={processingId === approvedUser.id || actionInProgress}
                        className="w-full py-2.5 px-4 bg-red-500/10 border border-red-500/20 hover:bg-red-650 hover:text-white text-red-400 text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <UserMinus size={14} />
                        {processingId === approvedUser.id ? 'Revoking...' : 'Revoke Edit Access'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* User Directory Tab */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 focus-within:border-zinc-700 transition-colors">
            <Search size={18} className="text-zinc-500 mr-3" />
            <input
              type="text"
              placeholder="Search user registry by name or email..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none w-full"
            />
          </div>

          {loadingUsers ? (
            <div className="py-12 text-center text-zinc-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mb-3"></div>
              <p className="text-sm">Fetching user directory...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
              <p className="text-zinc-400 text-sm">
                No users found matching your search.
              </p>
            </div>
          ) : (
            <div className="bg-zinc-900 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/20 text-zinc-400 text-xs uppercase tracking-wider font-semibold">
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role / Credentials</th>
                      <th className="px-6 py-4">Registration Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {filteredUsers.map((item) => {
                      const isSelf = item.id === user?.id
                      const isPendingRequest = item.requesting_admin
                      
                      return (
                        <tr key={item.id} className="hover:bg-zinc-950/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-white">{item.full_name}</div>
                            <div className="text-xs text-zinc-500 font-mono">{item.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {item.role === 'admin' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-white">
                                  <Shield size={10} />
                                  Admin
                                </span>
                              ) : (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 border border-zinc-700 text-zinc-400">
                                    Viewer
                                  </span>
                                  {item.has_write_access && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                      <Edit3 size={10} />
                                      Write Access
                                    </span>
                                  )}
                                </div>
                              )}
                              
                              {isPendingRequest && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 animate-pulse">
                                  Access Requested
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-400">
                            {new Date(item.created_at).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {isSelf ? (
                              <span className="text-xs font-semibold text-zinc-500 italic px-3 py-1 bg-zinc-800 rounded-lg">
                                You (Active Admin)
                              </span>
                            ) : item.role === 'admin' ? (
                              <button
                                onClick={() => handleUpdateRole(item.id, 'viewer')}
                                disabled={processingId === item.id || actionInProgress}
                                className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-600 text-red-400 hover:text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 ml-auto disabled:opacity-50"
                              >
                                <UserMinus size={12} />
                                Demote to Viewer
                              </button>
                            ) : (
                              <div className="flex gap-2 justify-end">
                                {isPendingRequest && (
                                  <button
                                    onClick={() => handleApprove(item.id)}
                                    disabled={processingId === item.id || actionInProgress}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-50 shadow-md shadow-green-600/10"
                                  >
                                    <UserCheck size={12} />
                                    Approve Request
                                  </button>
                                )}
                                
                                {item.has_write_access ? (
                                  <button
                                    onClick={() => handleUpdateWriteAccess(item.id, false)}
                                    disabled={processingId === item.id || actionInProgress}
                                    className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-600 text-amber-400 hover:text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <UserMinus size={12} />
                                    Revoke Edit Access
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateWriteAccess(item.id, true)}
                                    disabled={processingId === item.id || actionInProgress}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <UserCheck size={12} />
                                    Grant Edit Access
                                  </button>
                                )}

                                <button
                                  onClick={() => handleUpdateRole(item.id, 'admin')}
                                  disabled={processingId === item.id || actionInProgress}
                                  className="px-3 py-1.5 bg-zinc-800 hover:bg-white border border-zinc-700 hover:border-white text-zinc-300 hover:text-zinc-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-50"
                                >
                                  <ShieldCheck size={12} />
                                  Make Admin
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
