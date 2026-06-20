import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DashboardMetricsCards from '../components/DashboardMetricsCards'
import DashboardCharts from '../components/DashboardCharts'
import DashboardTabs from '../components/DashboardTabs'
import DashboardWelcome from '../components/DashboardWelcome'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const cameFromLogin = location.state?.fromLogin === true

  const [showWelcome, setShowWelcome] = useState(cameFromLogin)
  const [dashboardActive, setDashboardActive] = useState(!cameFromLogin)
  const [hideTopBarGreeting, setHideTopBarGreeting] = useState(cameFromLogin)

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

  const handleWelcomeLeave = () => {
    setDashboardActive(true)
    setHideTopBarGreeting(false)
  }

  const handleWelcomeComplete = () => {
    setShowWelcome(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
          <p className="text-zinc-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Welcome animation overlay */}
      {showWelcome && (
        <DashboardWelcome
          userName={user?.full_name}
          onLeave={handleWelcomeLeave}
          onComplete={handleWelcomeComplete}
        />
      )}

      {/* Dashboard content */}
      <div
        style={{
          transition: 'transform 1000ms cubic-bezier(0.16, 1, 0.3, 1), opacity 1000ms ease-out',
          transform: dashboardActive ? 'translateY(0)' : 'translateY(80px)',
          opacity: dashboardActive ? 1 : 0,
        }}
      >
        {/* Dashboard Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-zinc-400">
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

        {/* Visualizations and Charts */}
        <div className="mb-8">
          <DashboardCharts />
        </div>
      </div>
    </div>
  )
}
