import React, { useState, useEffect, useMemo, Component } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api, { getWithCache, isCached } from '../services/api'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Truck,
  FileText,
  Building,
  Phone,
  Mail,
  TrendingUp,
  PieChart as PieIcon,
  ChevronRight,
  ChevronDown,
  Info,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  X,
  ExternalLink,
  DollarSign,
  Briefcase
} from 'lucide-react'

const STATUS_COLORS = {
  'Delivered (On Time)': '#22c55e',
  'Delivered (Late)': '#f97316',
  'In Transit': '#3b82f6',
  'Delayed': '#ef4444',
  'Draft': '#71717a'
}

// Error Boundary to catch render crashes and show them instead of blank screen
class DetailErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'white', padding: 40 }}>
          <h2>Something went wrong rendering this page.</h2>
          <pre style={{ color: '#f87171', whiteSpace: 'pre-wrap', marginTop: 16 }}>
            {this.state.error?.message || 'Unknown error'}
          </pre>
          <pre style={{ color: '#a1a1aa', fontSize: 11, marginTop: 8, whiteSpace: 'pre-wrap' }}>
            {this.state.error?.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

// Custom Tooltip for Recharts
const ChartTooltip = ({ active, payload, label, prefix = "" }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 px-4 shadow-2xl">
        <p className="text-xs text-zinc-500 font-semibold mb-1">{label}</p>
        <p className="text-sm font-semibold text-white">
          {payload[0].name}: <span className="text-green-400">{prefix}{payload[0].value?.toLocaleString()}</span>
        </p>
      </div>
    )
  }
  return null
}

export default function CustomerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Timeframe state: '1m', '3m', '6m', '1y'
  const [timeframe, setTimeframe] = useState('1m')

  // Document Draft Modal State
  const [activeDraftDoc, setActiveDraftDoc] = useState(null) // { type: 'waybill' | 'invoice', order: object }

  useEffect(() => {
    fetchCustomerAndOrders()
  }, [id])

  const fetchCustomerAndOrders = async () => {
    try {
      if (!isCached(`/customers/${id}`) || !isCached('/orders/', { params: { customer_id: id, limit: 100 } })) {
        setLoading(true)
      }
      
      // 1. Fetch Customer details with SWR cache
      const { data: customerData } = await getWithCache(`/customers/${id}`, {
        onCacheUpdate: (freshCustomer) => {
          setCustomer(freshCustomer)
        }
      })
      setCustomer(customerData)

      // 2. Fetch Orders for this customer with SWR cache
      const { data: ordersData } = await getWithCache('/orders/', {
        params: { customer_id: id, limit: 100 },
        onCacheUpdate: (freshOrders) => {
          setOrders(freshOrders.items || [])
        }
      })
      setOrders(ordersData.items || [])
      
      setError(null)
    } catch (err) {
      console.error('Failed to load customer profile details:', err)
      if (!customer) {
        setError('Failed to load customer details or order logs.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Format currency helpers
  const formatCurrency = (amount) => {
    const val = typeof amount === 'number' ? amount : 0
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val)
  }

  const formatDate = (dateString, showTime = false) => {
    if (!dateString) return 'N/A'
    try {
      const options = {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...(showTime && { hour: '2-digit', minute: '2-digit' })
      }
      const d = new Date(dateString)
      if (isNaN(d.getTime())) return 'N/A'
      return d.toLocaleDateString('en-US', options)
    } catch {
      return 'N/A'
    }
  }

  const getStatusBadgeClass = (status) => {
    const classes = {
      'In Transit': 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      'Delayed': 'text-red-400 border-red-500/30 bg-red-500/10',
      'Delivered (On Time)': 'text-green-400 border-green-500/30 bg-green-500/10',
      'Delivered (Late)': 'text-orange-400 border-orange-500/30 bg-orange-500/10',
      'Draft': 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10'
    }
    return classes[status] || 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10'
  }

  // --- Filtering orders based on selected timeframe ---
  const timeframeFilteredOrders = useMemo(() => {
    const now = new Date()
    let cutoffDate = new Date()

    if (timeframe === '1m') {
      cutoffDate.setDate(now.getDate() - 30)
    } else if (timeframe === '3m') {
      cutoffDate.setDate(now.getDate() - 90)
    } else if (timeframe === '6m') {
      cutoffDate.setDate(now.getDate() - 180)
    } else if (timeframe === '1y') {
      cutoffDate.setDate(now.getDate() - 365)
    }

    return (orders || []).filter(order => {
      if (!order || !order.dispatch_time) return false
      const orderDate = new Date(order.dispatch_time)
      if (isNaN(orderDate.getTime())) return false
      return orderDate >= cutoffDate
    })
  }, [orders, timeframe])

  // --- 1. Order Volume Trend (over chosen timeframe) ---
  const orderTrendData = useMemo(() => {
    if (!timeframeFilteredOrders || timeframeFilteredOrders.length === 0) return []

    // Group by day for 1m, else group by week/month for larger scopes
    const grouped = {}
    
    timeframeFilteredOrders.forEach(order => {
      if (!order || !order.dispatch_time) return
      const dateObj = new Date(order.dispatch_time)
      if (isNaN(dateObj.getTime())) return
      
      let key = ""
      if (timeframe === '1m') {
        // Group by day: "Jun 20"
        key = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      } else {
        // Group by month: "Jun 2026"
        key = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      }
      
      grouped[key] = (grouped[key] || 0) + 1
    })

    // Sort chronologically
    return Object.entries(grouped).map(([name, count]) => ({
      name,
      orders: count
    }))
  }, [timeframeFilteredOrders, timeframe])

  // Calculate volume growth compared to the previous timeframe
  const growthMetrics = useMemo(() => {
    const currentCount = timeframeFilteredOrders.length
    const now = new Date()
    let rangeDays = 30
    
    if (timeframe === '1m') rangeDays = 30
    else if (timeframe === '3m') rangeDays = 90
    else if (timeframe === '6m') rangeDays = 180
    else if (timeframe === '1y') rangeDays = 365

    const currentCutoff = new Date()
    currentCutoff.setDate(now.getDate() - rangeDays)
    
    const prevCutoff = new Date()
    prevCutoff.setDate(now.getDate() - (rangeDays * 2))

    const prevPeriodOrders = (orders || []).filter(order => {
      if (!order || !order.dispatch_time) return false
      const orderDate = new Date(order.dispatch_time)
      if (isNaN(orderDate.getTime())) return false
      return orderDate >= prevCutoff && orderDate < currentCutoff
    })

    const prevCount = prevPeriodOrders.length
    let percent = 0
    if (prevCount > 0) {
      percent = ((currentCount - prevCount) / prevCount) * 100
    } else if (currentCount > 0) {
      percent = 100.0
    }

    return {
      prevCount,
      percentage: percent.toFixed(1),
      isPositive: percent >= 0
    }
  }, [orders, timeframeFilteredOrders, timeframe])

  // --- 2. Product Distribution (Pie Chart) ---
  const productDistribution = useMemo(() => {
    const productQuantities = {};
    
    const ordersList = orders || [];
    ordersList.forEach(order => {
      if (!order || order.is_deleted) return
      (order.line_items || []).forEach(item => {
        const name = item?.product_name || 'Other Product'
        productQuantities[name] = (productQuantities[name] || 0) + (item?.quantity || 0)
      })
    })

    return Object.entries(productQuantities).map(([name, quantity]) => ({
      name,
      value: quantity
    })).sort((a, b) => b.value - a.value)
  }, [orders])

  // Generate dynamic distinct HSL colors based on product count
  const productColors = useMemo(() => {
    const count = productDistribution.length
    const colors = []
    for (let i = 0; i < count; i++) {
      // Space colors out evenly around the hue circle
      const hue = (i * 360) / (count || 1)
      colors.push(`hsl(${hue}, 65%, 55%)`)
    }
    return colors
  }, [productDistribution])

  // --- 3. Delivery Status / On-Time Rate ---
  const deliveryMetrics = useMemo(() => {
    let deliveredOnTime = 0
    let deliveredLate = 0
    let delayed = 0
    let inTransit = 0
    let draft = 0;

    const allOrders = orders || [];
    allOrders.forEach(order => {
      if (!order) return
      const status = order.order_status
      if (status === 'Delivered (On Time)') deliveredOnTime++
      else if (status === 'Delivered (Late)') deliveredLate++
      else if (status === 'Delayed') delayed++
      else if (status === 'In Transit') inTransit++
      else if (status === 'Draft') draft++
    })

    const totalEvaluated = deliveredOnTime + deliveredLate + delayed
    const onTimeRate = totalEvaluated > 0 ? (deliveredOnTime / totalEvaluated) * 100 : 0

    const statusChartData = [
      { name: 'Delivered (On Time)', count: deliveredOnTime },
      { name: 'Delivered (Late)', count: deliveredLate },
      { name: 'Delayed', count: delayed },
      { name: 'In Transit', count: inTransit },
      { name: 'Draft', count: draft }
    ].filter(item => item.count > 0)

    return {
      onTimeRate: onTimeRate.toFixed(1),
      statusChartData,
      counts: { deliveredOnTime, deliveredLate, delayed, inTransit, draft }
    }
  }, [orders])

  // --- General Summary Statistics ---
  const summaryMetrics = useMemo(() => {
    const totalSpent = (orders || []).reduce((sum, order) => sum + (order?.total_amount || 0), 0)
    const avgOrderValue = (orders || []).length > 0 ? totalSpent / orders.length : 0
    return {
      totalSpent,
      avgOrderValue
    }
  }, [orders])

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-zinc-400">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mb-4"></div>
        <p className="text-sm font-semibold">Generating customer profiles & visualizations...</p>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="max-w-3xl mx-auto mt-12 bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl">
        <AlertTriangle size={48} className="mx-auto text-red-400 mb-4 animate-pulse" />
        <p className="text-zinc-200 font-semibold text-lg">{error || "Customer registry not found"}</p>
        <Link
          to="/customers"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-850 hover:bg-zinc-800 text-white rounded-xl transition-all border border-zinc-800"
        >
          <ArrowLeft size={16} /> Back to Customer Directory
        </Link>
      </div>
    )
  }

  return (
    <DetailErrorBoundary>
    <div className="max-w-7xl mx-auto pb-16 px-4">
      {/* Header Profile details */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 mt-2">
        <div className="w-full">
          <Link
            to="/customers"
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-3 text-sm"
          >
            <ArrowLeft size={16} /> Back to Customer Directory
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl font-bold text-white shadow-inner">
              {(customer?.name || '').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">{customer?.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5 text-xs text-zinc-400">
                <div className="flex items-center gap-1">
                  <MapPin size={13} className="text-zinc-500" />
                  <span>{customer?.city ? `${customer.city}, ` : ''}{customer?.state || 'N/A'} State</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-1">
                    <Mail size={13} className="text-zinc-500" />
                    <span className="font-mono">{customer.email}</span>
                  </div>
                )}
                {customer.contact_number && (
                  <div className="flex items-center gap-1">
                    <Phone size={13} className="text-zinc-500" />
                    <span className="font-mono">{customer.contact_number}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Total Dispatched Orders</span>
          <span className="text-3xl font-black text-white block mt-2">{orders.length}</span>
          <div className="absolute right-5 bottom-5 text-zinc-800 group-hover:text-zinc-700 transition-colors">
            <Briefcase size={36} />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Accumulated Order Value</span>
          <span className="text-3xl font-black text-green-400 block mt-2" style={{ fontFamily: '"Lora", Georgia, serif' }}>
            {formatCurrency(summaryMetrics.totalSpent)}
          </span>
          <div className="absolute right-5 bottom-5 text-zinc-800 group-hover:text-zinc-700 transition-colors">
            <DollarSign size={36} />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">On-Time Delivery Rate</span>
          <span className="text-3xl font-black text-blue-400 block mt-2">
            {deliveryMetrics.onTimeRate}%
          </span>
          <div className="absolute right-5 bottom-5 text-zinc-800 group-hover:text-zinc-700 transition-colors">
            <CheckCircle2 size={36} />
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Average Order Value</span>
          <span className="text-3xl font-black text-white block mt-2" style={{ fontFamily: '"Lora", Georgia, serif' }}>
            {formatCurrency(summaryMetrics.avgOrderValue)}
          </span>
          <div className="absolute right-5 bottom-5 text-zinc-800 group-hover:text-zinc-700 transition-colors">
            <TrendingUp size={36} />
          </div>
        </div>
      </div>

      {/* Analytics Visualizations Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Trend Visualization Card (2 cols) */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp size={22} className="text-zinc-400" />
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Order Volume {timeframe === '1m' ? '(Last 30 Days)' : timeframe === '3m' ? '(Last 3 Months)' : timeframe === '6m' ? '(Last 6 Months)' : '(Last Year)'}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {timeframe === '1m' ? 'Daily trend of dispatched customer orders' : 'Weekly trend of dispatched customer orders'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 self-start sm:self-center">
              {/* Sleek Period Dropdown Selector */}
              <div className="relative">
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="appearance-none bg-zinc-950/60 hover:bg-zinc-950/90 border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-400 hover:text-white pl-3.5 pr-8 py-2 rounded-xl cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-zinc-700"
                >
                  <option value="1m">Last 30 Days</option>
                  <option value="3m">Last 3 Months</option>
                  <option value="6m">Last 6 Months</option>
                  <option value="1y">Last Year</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>

              {/* Right Metric Box */}
              <div className="bg-[#121214] border border-zinc-800/80 px-6 py-3.5 rounded-2xl flex items-center gap-8">
                <div>
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">TOTAL ORDERS</span>
                  <span className="text-2xl font-bold text-white mt-1 block leading-tight">{timeframeFilteredOrders.length}</span>
                </div>
                <div className="w-px h-8 bg-zinc-800/60" />
                <div>
                  <span className="text-[10px] text-zinc-500 font-semibold block">
                    {timeframe === '1m' ? 'vs. previous 30 days' : timeframe === '3m' ? 'vs. previous 3 months' : timeframe === '6m' ? 'vs. previous 6 months' : 'vs. previous year'}
                  </span>
                  <span className="text-2xl font-bold text-white mt-1 block leading-tight">
                    {growthMetrics.isPositive ? '↑' : '↓'} {Math.abs(growthMetrics.percentage)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Graphic Area */}
          <div className="h-64 w-full">
            {orderTrendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-xs bg-zinc-950/20 border border-dashed border-zinc-850 rounded-xl">
                No orders registered within this time range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={orderTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="customerOrderColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="orders"
                    stroke="none"
                    fill="url(#customerOrderColor)"
                    fillOpacity={1}
                  />
                  <Area
                    type="monotone"
                    dataKey="orders"
                    stroke="#ffffff"
                    strokeWidth={2}
                    fill="none"
                    activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 1.5, fill: '#18181b' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Product Distribution Pie Chart (1 col) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl group">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PieIcon size={18} className="text-zinc-400" />
              Consigned Products
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Breakdown of product volume distributions</p>
          </div>

          <div className="h-44 relative flex items-center justify-center my-2">
            {productDistribution.length === 0 ? (
              <div className="text-zinc-500 text-xs">No product log registry</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    className="spin-roll"
                    data={productDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {productDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={productColors[index % productColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip prefix="" />} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {/* Center Summary Label */}
            {productDistribution.length > 0 && (
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-black text-white">
                  {productDistribution.length}
                </span>
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Products</span>
              </div>
            )}
          </div>

          {/* Dynamic Scrollable Product Legend */}
          <div className="max-h-[100px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
            {productDistribution.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: productColors[idx % productColors.length] }}
                  />
                  <span className="text-zinc-300 truncate" title={item.name}>{item.name}</span>
                </div>
                <span className="text-zinc-500 font-semibold font-mono pl-2">{item.value.toLocaleString()} qty</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Orders Log Ledger Table (2 cols) */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl overflow-hidden flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <FileText size={18} className="text-zinc-400" />
              Order Dispatch Manifest Logs
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-850 bg-zinc-950/40 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Manifest ID</th>
                    <th className="px-4 py-3 text-center">Day & Date</th>
                    <th className="px-4 py-3 text-center">Fulfillment Status</th>
                    <th className="px-4 py-3 text-center">Valuation</th>
                    <th className="px-4 py-3 text-right">Draft Papers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-8 text-center text-zinc-500 text-xs">
                        No orders recorded for this customer.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order, idx) => (
                      <tr key={order?.id || idx} className="hover:bg-zinc-850/20 transition-colors text-xs">
                        <td className="px-4 py-4 font-bold text-white">
                          <Link to={`/orders/${order?.id}`} className="hover:underline flex items-center gap-1">
                            <span>{order?.order_number || 'N/A'}</span>
                            <ExternalLink size={10} className="text-zinc-500" />
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-center text-zinc-300 font-medium">
                          {formatDate(order?.dispatch_time)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeClass(order?.order_status)}`}>
                            {order?.order_status || 'Draft'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-white font-bold" style={{ fontFamily: '"Lora", Georgia, serif' }}>
                          {formatCurrency(order?.total_amount)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setActiveDraftDoc({ type: 'waybill', order })}
                              className="px-2 py-1 bg-zinc-950 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 hover:border-zinc-700 font-semibold rounded text-[10px] transition-colors"
                            >
                              Waybill
                            </button>
                            <button
                              onClick={() => setActiveDraftDoc({ type: 'invoice', order })}
                              className="px-2 py-1 bg-zinc-950 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 hover:border-zinc-700 font-semibold rounded text-[10px] transition-colors"
                            >
                              Invoice
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Fulfillment Status Gauge (1 col) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock size={18} className="text-zinc-400" />
              Status Distribution
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Breakdown of fulfillment pipeline states</p>
          </div>

          {/* Donut Progress chart */}
          <div className="h-44 relative flex items-center justify-center my-3">
            {deliveryMetrics.statusChartData.length === 0 ? (
              <div className="text-zinc-500 text-xs">No status registry data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deliveryMetrics.statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {deliveryMetrics.statusChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.name] || '#71717a'}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip prefix="" />} />
                </PieChart>
              </ResponsiveContainer>
            )}
            
            {/* Center Gauge Percentage */}
            {deliveryMetrics.statusChartData.length > 0 && (
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-white">
                  {deliveryMetrics.onTimeRate}%
                </span>
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">On-Time Rate</span>
              </div>
            )}
          </div>

          {/* Legend Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
            {Object.entries(deliveryMetrics.counts).map(([key, count]) => {
              const nameMap = {
                deliveredOnTime: 'Delivered (On Time)',
                deliveredLate: 'Delivered (Late)',
                delayed: 'Delayed',
                inTransit: 'In Transit',
                draft: 'Draft'
              }
              const label = nameMap[key] || key
              if (count === 0) return null
              return (
                <div key={key} className="flex items-center gap-2 text-zinc-300">
                  <span 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[label] || '#71717a' }}
                  />
                  <span className="truncate">{label} ({count})</span>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Document Draft Viewer Modal Overlay */}
      {activeDraftDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl relative flex flex-col max-h-[90vh]">
            
            {/* Modal Actions Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-850 bg-zinc-900/40">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Draft {activeDraftDoc.type === 'waybill' ? 'Waybill Specification' : 'Invoice Specifications'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors"
                  title="Print Document"
                >
                  <Printer size={16} />
                </button>
                <button
                  onClick={() => setActiveDraftDoc(null)}
                  className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Document body (looks like paper) */}
            <div className="overflow-y-auto p-8 md:p-12 bg-white text-zinc-900 flex-1 font-serif select-text">
              
              {/* Document Header */}
              <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-6">
                <div>
                  <h2 className="text-xl font-sans font-black tracking-tighter text-zinc-950">DIVERSAY LOGISTICS LTD.</h2>
                  <p className="text-[10px] font-sans font-semibold text-zinc-500 uppercase tracking-widest mt-1">Domestic Delivery Route Pipeline & Dispatch</p>
                  <p className="text-[10px] font-sans text-zinc-400 mt-0.5">Plot 12, Logistics Industrial Estate, Agege, Lagos</p>
                </div>
                <div className="text-right">
                  <h3 className="text-base font-sans font-black uppercase text-zinc-950">
                    {activeDraftDoc.type === 'waybill' ? 'WAYBILL DRAFT' : 'PRO-FORMA INVOICE'}
                  </h3>
                  <p className="text-xs font-mono font-bold text-zinc-800 mt-1">
                    {activeDraftDoc.type === 'waybill' 
                      ? `WB-${activeDraftDoc.order.waybill_number || activeDraftDoc.order.order_number}`
                      : `INV-${activeDraftDoc.order.invoice_number || activeDraftDoc.order.order_number}`
                    }
                  </p>
                  <p className="text-[10px] font-sans text-zinc-400 mt-1">Date: {new Date(activeDraftDoc.order.dispatch_time || Date.now()).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Client & Transit Information Info */}
              <div className="grid grid-cols-2 gap-6 my-6 text-[11px] font-sans">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Consignee Address Details</span>
                  <p className="font-bold text-zinc-950 text-xs">{customer.name}</p>
                  <p className="text-zinc-600 leading-normal">{customer.address || "N/A Address Registry"}</p>
                  <p className="text-zinc-600">{customer.city ? `${customer.city}, ` : ''}{customer.state} State</p>
                  <p className="text-zinc-500">{customer.contact_number}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">Logistical Dispatch manifest</span>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-zinc-700">
                    <span className="text-zinc-400">Order Reference:</span>
                    <span className="font-bold text-zinc-900">{activeDraftDoc.order.order_number}</span>
                    
                    <span className="text-zinc-400">Driver Carrier:</span>
                    <span>{activeDraftDoc.order.driver_name || 'Not Commissioned'}</span>
                    
                    <span className="text-zinc-400">Vehicle Carrier:</span>
                    <span>{activeDraftDoc.order.vehicle_number || 'Not Registered'}</span>
                    
                    <span className="text-zinc-400">Status Code:</span>
                    <span className="font-bold text-zinc-900">{activeDraftDoc.order.order_status}</span>
                  </div>
                </div>
              </div>

              {/* Consignment Itemized Table */}
              <div className="my-6">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-400 text-zinc-500 uppercase font-sans text-[10px] tracking-wider">
                      <th className="py-2 font-bold">Consignment Item Specification</th>
                      <th className="py-2 text-right font-bold">Unit Type</th>
                      <th className="py-2 text-center font-bold">Quantity</th>
                      {activeDraftDoc.type === 'invoice' && (
                        <>
                          <th className="py-2 text-center font-bold">Unit Price</th>
                          <th className="py-2 text-right font-bold">Line Subtotal</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {(activeDraftDoc.order.line_items || []).map((item, idx) => (
                      <tr key={idx} className="text-zinc-800">
                        <td className="py-3 font-bold text-zinc-950">{item.product_name}</td>
                        <td className="py-3 text-right capitalize">{item.unit}</td>
                        <td className="py-3 text-center font-mono">{item.quantity}</td>
                        {activeDraftDoc.type === 'invoice' && (
                          <>
                            <td className="py-3 text-center font-mono">{formatCurrency(item.unit_price)}</td>
                            <td className="py-3 text-right font-bold text-zinc-950">{formatCurrency(item.unit_price * item.quantity)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Invoicing summary block */}
              {activeDraftDoc.type === 'invoice' && (
                <div className="flex justify-end pt-4 border-t border-zinc-200">
                  <div className="w-64 text-xs space-y-1.5 font-sans">
                    <div className="flex justify-between font-bold text-zinc-900 border-t border-zinc-300 pt-2 text-sm">
                      <span>Valuation Sum Total:</span>
                      <span>{formatCurrency(activeDraftDoc.order.total_amount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Waybill signatures */}
              {activeDraftDoc.type === 'waybill' && (
                <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t border-zinc-100 font-sans text-[10px]">
                  <div>
                    <span className="block border-b border-zinc-400 h-8" />
                    <span className="block text-zinc-400 uppercase font-bold tracking-wider mt-1 text-center">Dispatch Supervisor Signature</span>
                  </div>
                  <div>
                    <span className="block border-b border-zinc-400 h-8" />
                    <span className="block text-zinc-400 uppercase font-bold tracking-wider mt-1 text-center">Receiver Consignee Signature & Date</span>
                  </div>
                </div>
              )}

              {/* General footer */}
              <div className="mt-16 text-center border-t border-zinc-200 pt-4 text-[9px] text-zinc-400 font-sans leading-normal">
                <p>This document is generated automatically by Diversay Logistics Platform.</p>
                <p className="mt-0.5">Please address any questions about invoices or waybills to billing@diversay.com</p>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
    </DetailErrorBoundary>
  )
}
