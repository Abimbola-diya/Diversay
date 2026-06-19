import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import DashboardMetricsCards from '../components/DashboardMetricsCards'
import DashboardTabs from '../components/DashboardTabs'
import OrdersTable from '../components/OrdersTable'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Redirect if not authenticated
    if (!loading && !user) {
      navigate('/login')
    }
  }, [user, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="lg:ml-0 pt-16 md:pt-0">
        {/* Top Bar */}
        <TopBar />

        {/* Content */}
        <main className="p-8 max-w-7xl mx-auto">
          {/* Dashboard Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-slate-400">
              Overview of all logistics operations and order management
            </p>
          </div>

          {/* Metrics Cards */}
          <div className="mb-8">
            <DashboardMetricsCards />
          </div>

          {/* Tabs Section */}
          <div className="mb-8">
            <DashboardTabs />
          </div>

          {/* Orders Table */}
          <div className="mb-8">
            <OrdersTable />
          </div>
        </main>
      </div>
    </div>
  )
}
