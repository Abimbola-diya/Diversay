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
      'Draft': 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
    return colors[status] || colors['Draft']
  }

  const totalPages = Math.ceil(totalOrders / pageSize)

  if (error && orders.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
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
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      {/* Header with Filters */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
          <h3 className="text-xl font-bold text-white">All Orders</h3>
          <div className="text-sm text-slate-400">
            Showing {orders.length > 0 ? page * pageSize + 1 : 0} to {Math.min((page + 1) * pageSize, totalOrders)} of {totalOrders} orders
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search by Order Number */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search order #..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPage(0)
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Filter by Date Range */}
          <div className="relative">
            <Calendar size={18} className="absolute left-3 top-3 text-slate-500" />
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value)
                setPage(0)
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 appearance-none transition-colors"
            >
              <option value="30days">Last 30 days</option>
              <option value="7days">Last 7 days</option>
              <option value="today">Today</option>
              <option value="all">All time</option>
            </select>
          </div>

          {/* Filter by State */}
          <div className="relative">
            <Filter size={18} className="absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by state..."
              value={filterState}
              onChange={(e) => {
                setFilterState(e.target.value)
                setPage(0)
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Filter by Status */}
          <div className="relative">
            <Filter size={18} className="absolute left-3 top-3 text-slate-500" />
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                setPage(0)
              }}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-500 appearance-none transition-colors"
            >
              <option value="">All statuses</option>
              <option value="Draft">Draft</option>
              <option value="In Transit">In Transit</option>
              <option value="Delayed">Delayed</option>
              <option value="Delivered (On Time)">Delivered (On Time)</option>
              <option value="Delivered (Late)">Delivered (Late)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-8 text-center text-slate-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mb-3"></div>
          <p>Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center text-slate-400">
          <p>No orders found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300 w-10"></th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300 min-w-[200px]">
                  Customer Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300 min-w-[180px]">
                  Product(s)
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300 min-w-[120px]">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300 min-w-[100px]">
                  Location
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <React.Fragment key={order.id}>
                  {/* Main Row - 4 Primary Fields */}
                  <tr className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div
                        className={`w-1 h-full rounded-full transition-colors ${
                          order.order_status === 'In Transit'
                            ? 'bg-blue-500'
                            : order.order_status === 'Delayed'
                            ? 'bg-red-500'
                            : order.order_status === 'Delivered (On Time)'
                            ? 'bg-green-500'
                            : order.order_status === 'Delivered (Late)'
                            ? 'bg-orange-500'
                            : 'bg-slate-500'
                        }`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{order.customer_name}</p>
                      <p className="text-slate-500 text-xs">{order.order_number}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {order.line_items.map((item, idx) => (
                          <p key={idx} className="text-slate-300 text-sm">
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
                      <p className="text-slate-300 text-sm">{order.customer_state || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleRowExpand(order.id)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        title="View more fields"
                      >
                        <ChevronDown
                          size={20}
                          className={`text-slate-400 transition-transform ${
                            expandedRows.has(order.id) ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row - Additional Fields */}
                  {expandedRows.has(order.id) && (
                    <tr className="border-b border-slate-800 bg-slate-800/20">
                      <td colSpan="6" className="px-6 py-4">
                        <div
                          className="overflow-x-auto pb-2"
                          onScroll={(e) => handleTableScroll(e, order.id)}
                        >
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 min-w-max md:min-w-full">
                            {/* Order Number */}
                            <div>
                              <p className="text-slate-500 text-xs font-medium">Order #</p>
                              <p className="text-white text-sm font-mono">{order.order_number}</p>
                            </div>

                            {/* Total Quantity */}
                            <div>
                              <p className="text-slate-500 text-xs font-medium">Quantity</p>
                              <p className="text-white text-sm">
                                {order.line_items.reduce((sum, item) => sum + item.quantity, 0)} units
                              </p>
                            </div>

                            {/* Dispatch Time */}
                            <div>
                              <p className="text-slate-500 text-xs font-medium">Sent Out</p>
                              <p className="text-white text-sm">{formatDate(order.dispatch_time)}</p>
                              {order.dispatch_time && (
                                <p className="text-slate-500 text-xs">
                                  {formatDistanceToNow(new Date(order.dispatch_time), { addSuffix: true })}
                                </p>
                              )}
                            </div>

                            {/* Expected Delivery */}
                            <div>
                              <p className="text-slate-500 text-xs font-medium">Expected Delivery</p>
                              <p className="text-white text-sm">{formatDate(order.expected_delivery_time)}</p>
                            </div>

                            {/* Actual Delivery */}
                            <div>
                              <p className="text-slate-500 text-xs font-medium">Actual Delivery</p>
                              <p className="text-white text-sm">
                                {order.actual_delivery_time ? formatDate(order.actual_delivery_time) : 'Pending'}
                              </p>
                            </div>

                            {/* Status */}
                            <div>
                              <p className="text-slate-500 text-xs font-medium">Status</p>
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 rounded-lg transition-colors"
          >
            <ChevronLeft size={18} />
            Previous
          </button>

          <div className="text-slate-400 text-sm">
            Page {page + 1} of {totalPages}
          </div>

          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 rounded-lg transition-colors"
          >
            Next
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
