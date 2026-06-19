import React, { useState, useEffect } from 'react'
import api from '../services/api'
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Search, Calendar } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function OrdersTable() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProductType, setFilterProductType] = useState('')
  const [dateRange, setDateRange] = useState('30days')
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [scrollPosition, setScrollPosition] = useState({})

  const pageSize = 50

  useEffect(() => {
    fetchOrders()
  }, [page, searchTerm, filterState, filterStatus, filterProductType, dateRange])

  const fetchOrders = async () => {
    try {
      setLoading(true)

      let params = {
        skip: page * pageSize,
        limit: pageSize
      }

      // Add filters
      if (searchTerm) params.order_number = searchTerm
      if (filterState) params.state = filterState
      if (filterStatus) params.status = filterStatus
      if (filterProductType) params.product_name = filterProductType

      // Add date range filter
      const now = new Date()
      if (dateRange === '30days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        params.start_date = thirtyDaysAgo.toISOString()
        params.end_date = now.toISOString()
      }

      const response = await api.get('/orders', { params })
      setOrders(response.data.items || [])
      setTotalOrders(response.data.total || 0)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch orders:', err)
      setError('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  const toggleRowExpand = (orderId) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId)
    } else {
      newExpanded.add(orderId)
    }
    setExpandedRows(newExpanded)
  }

  const handleTableScroll = (e, orderId) => {
    setScrollPosition({
      ...scrollPosition,
      [orderId]: e.currentTarget.scrollLeft
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return 'N/A'
    }
  }

  const getStatusBadgeColor = (status) => {
    const colors = {
      'In Transit': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Delayed': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Delivered (On Time)': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Delivered (Late)': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Draft': 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    }
    return colors[status] || colors['Draft']
  }

  const totalPages = Math.ceil(totalOrders / pageSize)

  if (error && orders.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchOrders}
          className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Inline styles for the uniform electron border drawing animation */}
      <style>{`
        @keyframes border-draw {
          from {
            stroke-dashoffset: 100%;
          }
          to {
            stroke-dashoffset: 0%;
          }
        }
        .animate-border-draw {
          animation: border-draw 8s linear infinite;
        }
      `}</style>

      {/* Header with Filters */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
          <h3 className="text-xl font-bold text-white">All Orders</h3>
          <div className="text-sm text-zinc-400">
            Showing {orders.length > 0 ? page * pageSize + 1 : 0} to {Math.min((page + 1) * pageSize, totalOrders)} of {totalOrders} orders
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search by Order Number */}
          <div className="relative group rounded-lg bg-zinc-800 border border-zinc-700 transition-all focus-within:border-transparent">
            {/* Electron border glow on focus-within */}
            <div className="absolute inset-0 rounded-lg pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 z-0">
              <svg className="absolute inset-0 w-full h-full rounded-lg" overflow="visible">
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="8"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  pathLength="100"
                  strokeDasharray="30 70"
                  className="blur-[2px] opacity-30 animate-border-draw"
                />
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="8"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  pathLength="100"
                  strokeDasharray="30 70"
                  className="opacity-100 animate-border-draw"
                />
              </svg>
            </div>

            <Search size={18} className="absolute left-3 top-3 text-zinc-500 z-10" />
            <input
              type="text"
              placeholder="Search order #..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(0)
              }}
              className="w-full pl-10 pr-4 py-2 bg-transparent text-zinc-100 placeholder-zinc-500 focus:outline-none z-10 relative"
            />
          </div>

          {/* Filter by Date Range */}
          <div className="relative group rounded-lg bg-zinc-800 border border-zinc-700 transition-all focus-within:border-transparent">
            {/* Electron border glow on focus-within */}
            <div className="absolute inset-0 rounded-lg pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 z-0">
              <svg className="absolute inset-0 w-full h-full rounded-lg" overflow="visible">
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="8"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  pathLength="100"
                  strokeDasharray="30 70"
                  className="blur-[2px] opacity-30 animate-border-draw"
                />
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="8"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  pathLength="100"
                  strokeDasharray="30 70"
                  className="opacity-100 animate-border-draw"
                />
              </svg>
            </div>

            <Calendar size={18} className="absolute left-3 top-3 text-zinc-500 z-10 pointer-events-none" />
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value)
                setPage(0)
              }}
              className="w-full pl-10 pr-10 py-2 bg-transparent text-zinc-100 focus:outline-none appearance-none transition-colors z-10 relative cursor-pointer"
            >
              <option value="30days" className="bg-zinc-800 text-zinc-100">Last 30 days</option>
              <option value="7days" className="bg-zinc-800 text-zinc-100">Last 7 days</option>
              <option value="today" className="bg-zinc-800 text-zinc-100">Today</option>
              <option value="all" className="bg-zinc-800 text-zinc-100">All time</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-3 text-zinc-500 pointer-events-none z-10" />
          </div>

          {/* Filter by State */}
          <div className="relative group rounded-lg bg-zinc-800 border border-zinc-700 transition-all focus-within:border-transparent">
            {/* Electron border glow on focus-within */}
            <div className="absolute inset-0 rounded-lg pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 z-0">
              <svg className="absolute inset-0 w-full h-full rounded-lg" overflow="visible">
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="8"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  pathLength="100"
                  strokeDasharray="30 70"
                  className="blur-[2px] opacity-30 animate-border-draw"
                />
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="8"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  pathLength="100"
                  strokeDasharray="30 70"
                  className="opacity-100 animate-border-draw"
                />
              </svg>
            </div>

            <Filter size={18} className="absolute left-3 top-3 text-zinc-500 z-10" />
            <input
              type="text"
              placeholder="Filter by state..."
              value={filterState}
              onChange={(e) => {
                setFilterState(e.target.value)
                setPage(0)
              }}
              className="w-full pl-10 pr-4 py-2 bg-transparent text-zinc-100 placeholder-zinc-500 focus:outline-none z-10 relative"
            />
          </div>

          {/* Filter by Status */}
          <div className="relative group rounded-lg bg-zinc-800 border border-zinc-700 transition-all focus-within:border-transparent">
            {/* Electron border glow on focus-within */}
            <div className="absolute inset-0 rounded-lg pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 z-0">
              <svg className="absolute inset-0 w-full h-full rounded-lg" overflow="visible">
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="8"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  pathLength="100"
                  strokeDasharray="30 70"
                  className="blur-[2px] opacity-30 animate-border-draw"
                />
                <rect
                  x="0"
                  y="0"
                  width="100%"
                  height="100%"
                  rx="8"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  pathLength="100"
                  strokeDasharray="30 70"
                  className="opacity-100 animate-border-draw"
                />
              </svg>
            </div>

            <Filter size={18} className="absolute left-3 top-3 text-zinc-500 z-10 pointer-events-none" />
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                setPage(0)
              }}
              className="w-full pl-10 pr-10 py-2 bg-transparent text-zinc-100 focus:outline-none appearance-none transition-colors z-10 relative cursor-pointer"
            >
              <option value="" className="bg-zinc-800 text-zinc-100">All statuses</option>
              <option value="Draft" className="bg-zinc-800 text-zinc-100">Draft</option>
              <option value="In Transit" className="bg-zinc-800 text-zinc-100">In Transit</option>
              <option value="Delayed" className="bg-zinc-800 text-zinc-100">Delayed</option>
              <option value="Delivered (On Time)" className="bg-zinc-800 text-zinc-100">Delivered (On Time)</option>
              <option value="Delivered (Late)" className="bg-zinc-800 text-zinc-100">Delivered (Late)</option>
            </select>
            <ChevronDown size={16} className="absolute right-3 top-3 text-zinc-500 pointer-events-none z-10" />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-8 text-center text-zinc-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mb-3"></div>
          <p>Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center text-zinc-400">
          <p>No orders found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300 w-10"></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300 min-w-[200px]">
                  Customer Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300 min-w-[180px]">
                  Product(s)
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-zinc-300 min-w-[120px]">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-zinc-300 min-w-[100px]">
                  Location
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-zinc-300 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <React.Fragment key={order.id}>
                  {/* Main Row - 4 Primary Fields */}
                  <tr className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div
                        className={`w-1 h-full rounded-full transition-colors ${order.order_status === 'In Transit'
                            ? 'bg-blue-500'
                            : order.order_status === 'Delayed'
                              ? 'bg-red-500'
                              : order.order_status === 'Delivered (On Time)'
                                ? 'bg-green-500'
                                : order.order_status === 'Delivered (Late)'
                                  ? 'bg-orange-500'
                                  : 'bg-zinc-500'
                          }`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{order.customer_name}</p>
                      <p className="text-zinc-500 text-xs">{order.order_number}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {order.line_items.map((item, idx) => (
                          <p key={idx} className="text-zinc-300 text-sm">
                            {item.product_name}
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-white font-semibold">
                        {formatCurrency(order.total_amount)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-zinc-300 text-sm">{order.customer_state || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleRowExpand(order.id)}
                        className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                        title="View more fields"
                      >
                        <ChevronDown
                          size={20}
                          className={`text-zinc-400 transition-transform ${expandedRows.has(order.id) ? 'rotate-180' : ''
                            }`}
                        />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row - Additional Fields */}
                  {expandedRows.has(order.id) && (
                    <tr className="border-b border-zinc-800 bg-zinc-800/20">
                      <td colSpan="6" className="px-6 py-4">
                        <div
                          className="overflow-x-auto pb-2"
                          onScroll={(e) => handleTableScroll(e, order.id)}
                        >
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 min-w-max md:min-w-full">
                            {/* Order Number */}
                            <div>
                              <p className="text-zinc-500 text-xs font-medium">Order #</p>
                              <p className="text-white text-sm font-mono">{order.order_number}</p>
                            </div>

                            {/* Total Quantity */}
                            <div>
                              <p className="text-zinc-500 text-xs font-medium">Quantity</p>
                              <p className="text-white text-sm">
                                {order.line_items.reduce((sum, item) => sum + item.quantity, 0)} units
                              </p>
                            </div>

                            {/* Dispatch Time */}
                            <div>
                              <p className="text-zinc-500 text-xs font-medium">Sent Out</p>
                              <p className="text-white text-sm">{formatDate(order.dispatch_time)}</p>
                              {order.dispatch_time && (
                                <p className="text-zinc-500 text-xs">
                                  {formatDistanceToNow(new Date(order.dispatch_time), { addSuffix: true })}
                                </p>
                              )}
                            </div>

                            {/* Expected Delivery */}
                            <div>
                              <p className="text-zinc-500 text-xs font-medium">Expected Delivery</p>
                              <p className="text-white text-sm">{formatDate(order.expected_delivery_time)}</p>
                            </div>

                            {/* Actual Delivery */}
                            <div>
                              <p className="text-zinc-500 text-xs font-medium">Actual Delivery</p>
                              <p className="text-white text-sm">
                                {order.actual_delivery_time ? formatDate(order.actual_delivery_time) : 'Pending'}
                              </p>
                            </div>

                            {/* Status */}
                            <div>
                              <p className="text-zinc-500 text-xs font-medium">Status</p>
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(
                                  order.order_status
                                )}`}
                              >
                                {order.order_status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} />
            Previous
          </button>

          <div className="text-zinc-400 text-sm">
            Page {page + 1} of {totalPages}
          </div>

          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 rounded-lg transition-colors"
          >
            Next
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
