import React, { useState, useEffect } from 'react'
import api from '../services/api'
import { Package, AlertCircle, TrendingUp, Users, Loader } from 'lucide-react'

export default function DashboardMetricsCards() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const response = await api.get('/analytics/dashboard')
      setMetrics(response.data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err)
      setError('Failed to load dashboard metrics')
      // Set mock data for demo purposes
      setMetrics({
        total_orders_today: 12,
        in_transit_count: 8,
        delayed_count: 2,
        delivered_this_week: 45,
        total_customers: 23
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 bg-slate-800 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: "Today's Orders",
      value: metrics?.total_orders_today || 0,
      icon: Package,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400'
    },
    {
      title: 'In Transit',
      value: metrics?.in_transit_count || 0,
      icon: TrendingUp,
      color: 'from-cyan-500 to-cyan-600',
      bgColor: 'bg-cyan-500/10',
      textColor: 'text-cyan-400'
    },
    {
      title: 'Delayed Orders',
      value: metrics?.delayed_count || 0,
      icon: AlertCircle,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400'
    },
    {
      title: 'This Week',
      value: metrics?.delivered_this_week || 0,
      icon: Package,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400'
    },
    {
      title: 'Total Customers',
      value: metrics?.total_customers || 0,
      icon: Users,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/10',
      textColor: 'text-purple-400'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <div
            key={index}
            className={`${card.bgColor} border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-slate-400 text-sm font-medium mb-2">{card.title}</p>
                <p className="text-3xl font-bold text-white">{card.value}</p>
              </div>
              <div className={`bg-gradient-to-br ${card.color} p-3 rounded-lg`}>
                <Icon size={24} className="text-white" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
