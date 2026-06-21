import React, { useState, useEffect } from 'react'
import api, { getWithCache } from '../services/api'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import { TrendingUp, BarChart2, PieChart as PieIcon, Loader2 } from 'lucide-react'

const STATUS_COLORS = {
  'Delivered (On Time)': '#22c55e', // Green
  'Delivered (Late)': '#f97316',    // Orange
  'In Transit': '#3b82f6',          // Blue
  'Delayed': '#ef4444',             // Red
  'Draft': '#71717a'                // Zinc
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 px-4 shadow-xl">
        <p className="text-sm text-zinc-400 font-semibold mb-1">{label}</p>
        <p className="text-sm text-white">
          {payload[0].name} : <span className="font-semibold text-white">{payload[0].value}</span>
        </p>
      </div>
    )
  }
  return null
}

export default function DashboardCharts() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hoveredSlice, setHoveredSlice] = useState(null)
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      if (!data) {
        setLoading(true)
      }
      const { data: resData } = await getWithCache('/analytics/dashboard', {
        onCacheUpdate: (freshData) => {
          setData(freshData)
        }
      })
      setData(resData)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
      setError('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 min-h-[400px] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-zinc-400 mb-2" size={32} />
        <p className="text-zinc-400 text-sm">Loading analytics visualizations...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 min-h-[400px] flex items-center justify-center">
        <p className="text-red-400 text-sm">{error || 'No data available'}</p>
      </div>
    )
  }

  // Format 30 days trend data for the chart
  const trendData = (data.orders_last_30_days || []).map(item => {
    // Format date string to a shorter readable format (e.g. Jun 20)
    const dateObj = new Date(item.date)
    return {
      name: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      orders: item.count
    }
  })

  // Format state metrics
  const stateData = (data.top_5_states || []).map(item => ({
    name: item.state,
    orders: item.count
  }))

  // Format status distribution
  const statusData = (data.status_breakdown || []).map(item => ({
    name: item.status,
    value: item.count
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
      {/* Chart 1: Order Trend (2 columns on large screens) */}
      <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-zinc-400" />
              Order Volume (Last 30 Days)
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Daily trend of dispatched customer orders</p>
          </div>

          <div className="flex items-center bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-4 px-6 gap-8 self-start sm:self-center">
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 font-semibold tracking-wider">
                TOTAL ORDERS
              </span>
              <span className="text-xl font-semibold text-white mt-1">
                {data.total_orders_30_days}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 font-normal">
                vs. previous 30 days
              </span>
              <span 
                className="text-xl font-semibold text-white mt-1 flex items-center gap-1.5"
                style={{ textShadow: '0 0 8px rgba(255, 255, 255, 0.4)' }}
              >
                {data.orders_growth_percentage >= 0 ? (
                  <svg className="w-4 h-4 text-white stroke-[2.5] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white stroke-[2.5] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0l-7-7m7 7l7-7" />
                  </svg>
                )}
                <span>{Math.abs(data.orders_growth_percentage).toFixed(1)}%</span>
              </span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          {trendData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
              No order trend data available. Dispatched orders will show up here.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {/* Faint static vertical gradient for base depth */}
                  <linearGradient id="orderColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>

                  {/* Horizontal sweeping ripple gradient for the continuous stroke */}
                  <linearGradient id="rippleStrokeColor" y1="0%" y2="0%">
                    <animate attributeName="x1" values="-100%;100%;-100%" dur="8s" repeatCount="indefinite" />
                    <animate attributeName="x2" values="0%;200%;0%" dur="8s" repeatCount="indefinite" />
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#ffffff" stopOpacity={1.0} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#a1a1aa"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                {/* Layer 1: Base wave fill body */}
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke="none"
                  fill="url(#orderColor)"
                  fillOpacity={1}
                />
                {/* Layer 2: Continuous White Rippling Line Stroke */}
                <Area
                  type="monotone"
                  dataKey="orders"
                  stroke="url(#rippleStrokeColor)"
                  strokeWidth={2.5}
                  fill="none"
                  activeDot={{ r: 5.5, stroke: '#ffffff', strokeWidth: 1.5, fill: '#ffffff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 2: Status Breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <PieIcon size={20} className="text-zinc-400" />
            Status Distribution
          </h3>
          <p className="text-xs text-zinc-400 mt-1">Breakdown of current order fulfillment states</p>
        </div>

        <div 
          className="h-56 relative flex items-center justify-center"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredSlice(null)}
        >
          {statusData.length === 0 ? (
            <div className="text-zinc-500 text-sm">No status data available</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  <style>
                    {`
                      @keyframes rollPieAnim {
                        0%, 100% {
                          transform: rotate(0deg);
                        }
                        50% {
                          transform: rotate(360deg);
                        }
                      }
                      .recharts-pie {
                        transform-origin: center;
                        animation: rollPieAnim 30s ease-in-out infinite;
                      }
                      .recharts-pie:hover {
                        animation-play-state: paused;
                      }
                    `}
                  </style>
                </defs>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  onMouseEnter={(entry) => setHoveredSlice(entry)}
                  onMouseLeave={() => setHoveredSlice(null)}
                >
                  {statusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={STATUS_COLORS[entry.name] || '#71717a'}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* On-Time Rate HUD */}
          {data.on_time_percentage > 0 && (
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-white">{data.on_time_percentage}%</span>
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">On-Time Rate</span>
            </div>
          )}

          {/* Precise, rotation-aware Custom Tooltip with white text */}
          {hoveredSlice && (
            <div 
              className="absolute z-50 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 px-3.5 shadow-2xl pointer-events-none"
              style={{
                left: mousePos.x + 12,
                top: mousePos.y - 12,
                transform: 'translate(0, -50%)'
              }}
            >
              <p className="text-xs font-semibold text-white whitespace-nowrap">
                {hoveredSlice.name} : <span className="font-bold text-white">{hoveredSlice.value}</span>
              </p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {statusData.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_COLORS[item.name] || '#71717a' }}
              />
              <span className="text-xs text-zinc-300 truncate">{item.name} ({item.value})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart 3: Top States by Volume */}
      <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart2 size={20} className="text-zinc-400" />
            Top Delivery States
          </h3>
          <p className="text-xs text-zinc-400 mt-1">Leading destinations by total number of orders</p>
        </div>

        <div className="h-64 w-full">
          {stateData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
              No regional order data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#a1a1aa"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="#a1a1aa"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#27272a',
                    borderRadius: '12px',
                    color: '#ffffff'
                  }}
                  itemStyle={{ color: '#ffffff' }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                />
                <Bar 
                  dataKey="orders" 
                  radius={[0, 6, 6, 0]}
                  onMouseEnter={(data, index) => setHoveredBarIndex(index)}
                  onMouseLeave={() => setHoveredBarIndex(null)}
                >
                  {stateData.map((entry, index) => {
                    const isHovered = hoveredBarIndex === index
                    const baseOpacity = 0.75 - index * 0.12
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isHovered ? '#ffffff' : `rgba(255, 255, 255, ${baseOpacity})`}
                        style={{ cursor: 'pointer', transition: 'fill 0.2s ease' }}
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
