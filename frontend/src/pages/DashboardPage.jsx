import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import DashboardMetricsCards from '../components/DashboardMetricsCards'
import DashboardTabs from '../components/DashboardTabs'
import OrdersTable from '../components/OrdersTable'
import DashboardWelcome from '../components/DashboardWelcome'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const cameFromLogin = location.state?.fromLogin === true

  // Show welcome animation on every load (for testing — will revert later)
  const [showWelcome, setShowWelcome] = useState(true)
  const [hideTopBarGreeting, setHideTopBarGreeting] = useState(true)

  useEffect(() => {
    // Redirect if not authenticated
    if (!loading && !user) {
      navigate('/login')
    }
  }, [user, loading, navigate])

  // Clean up the state so refreshing the page won't replay the animation
  useEffect(() => {
    if (cameFromLogin) {
      window.history.replaceState({}, '')
    }
  }, [cameFromLogin])

  const handleWelcomeComplete = () => {
    setShowWelcome(false)
    setHideTopBarGreeting(false)
  }

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
      {/* Welcome animation overlay */}
      {showWelcome && (
        <DashboardWelcome
          userName={user?.full_name}
          onComplete={handleWelcomeComplete}
        />
      )}

      {/* Dashboard content — always rendered so TopBar positions can be measured */}
      <div style={{ opacity: 1 }}>
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="lg:ml-0 pt-16 md:pt-0">
          {/* Top Bar */}
          <TopBar hideGreeting={hideTopBarGreeting} />

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
    </div>
  )
}
