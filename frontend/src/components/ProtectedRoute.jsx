import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="text-zinc-400">Loading...</div>
      </div>
    )
  }

  return isAuthenticated ? (
    <div style={{ fontFamily: '"Lora", Georgia, serif', fontStyle: 'normal' }}>
      <Outlet />
    </div>
  ) : (
    <Navigate to="/login" replace />
  )
}
