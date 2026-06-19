import React, { useState, useEffect } from 'react'
import api from '../services/api'
import { Package, AlertCircle, TrendingUp, Users } from 'lucide-react'

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 animate-fadeIn">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 bg-zinc-800/40 rounded-xl border border-zinc-800/80 animate-pulse" />
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: "Today's Orders",
      value: metrics?.total_orders_today || 0,
      icon: Package
    },
    {
      title: 'In Transit',
      value: metrics?.in_transit_count || 0,
      icon: TrendingUp
    },
    {
      title: 'Delayed Orders',
      value: metrics?.delayed_count || 0,
      icon: AlertCircle
    },
    {
      title: 'This Week',
      value: metrics?.delivered_this_week || 0,
      icon: Package
    },
    {
      title: 'Total Customers',
      value: metrics?.total_customers || 0,
      icon: Users
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 animate-fadeIn">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <div
            key={index}
            className="bg-zinc-800/30 border border-zinc-800/80 hover:border-zinc-700/60 rounded-xl p-5 hover:shadow-md transition-all group duration-300"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-zinc-400 text-sm font-medium mb-2">{card.title}</p>
                <p className="text-3xl font-bold text-white">{card.value}</p>
              </div>
              <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-center transition-colors group-hover:border-white/20">
                <Icon size={20} className="text-zinc-300 group-hover:text-white transition-colors" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
