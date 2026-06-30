import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api, { getWithCache, isCached } from '../services/api'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Truck,
  FileText,
  Activity,
  User,
  Hash,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
  Edit3
} from 'lucide-react'

// Dropdown component for fuzzy product search
const ProductSearchDropdown = ({ query, products, onSelect }) => {
  const filtered = products
    .filter(p => p.name.toLowerCase().includes(query.toLowerCase()))

  if (filtered.length === 0) return null

  return (
    <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-800 border border-zinc-700/80 rounded-xl shadow-xl z-50 max-h-[132px] overflow-y-auto custom-product-dropdown-scroll backdrop-blur-md">
      <ul className="divide-y divide-zinc-750">
        {filtered.map((product) => (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => onSelect(product)}
              className="w-full px-3 py-2.5 text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-700/50 transition-colors"
            >
              {product.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Products state for editing
  const [products, setProducts] = useState([])
  const [isEditing, setIsEditing] = useState(false)

  // Edit fields state
  const [editWaybill, setEditWaybill] = useState('')
  const [editInvoice, setEditInvoice] = useState('')
  const [editDriver, setEditDriver] = useState('')
  const [editVehicle, setEditVehicle] = useState('')
  const [editDispatchTime, setEditDispatchTime] = useState('')
  const [editExpectedDelivery, setEditExpectedDelivery] = useState('')
  const [editActualDelivery, setEditActualDelivery] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editLineItems, setEditLineItems] = useState([])
  const [commitMessage, setCommitMessage] = useState('')
  const [activeProductSearchIndex, setActiveProductSearchIndex] = useState(null)

  useEffect(() => {
    fetchOrderDetails()
  }, [id])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.product-search-container')) {
        setActiveProductSearchIndex(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  const fetchOrderDetails = async () => {
    try {
      if (!isCached(`/orders/${id}`)) {
        setLoading(true)
      }

      // Fetch order details with SWR cache
      const { data: orderData } = await getWithCache(`/orders/${id}`, {
        onCacheUpdate: (freshOrder) => {
          setOrder(freshOrder)
        }
      })
      setOrder(orderData)

      // Fetch audit logs with SWR cache
      try {
        const { data: auditData } = await getWithCache(`/orders/${id}/audit-log`, {
          onCacheUpdate: (freshAudit) => {
            setAuditLogs(freshAudit || [])
          }
        })
        setAuditLogs(auditData || [])
      } catch (auditErr) {
        console.error("Failed to load audit logs for order:", auditErr)
      }

      setError(null)
    } catch (err) {
      console.error("Failed to fetch order details:", err)
      if (!order) {
        setError("Failed to load order details. Please verify the order ID.")
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products', { params: { limit: 100 } })
      setProducts(res.data.items || [])
    } catch (err) {
      console.error("Failed to load products registry:", err)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount)
  }

  const formatPhoneNumber = (phone) => {
    if (!phone) return 'N/A'
    const cleaned = phone.replace(/\D/g, '')
    if (!cleaned) return phone
    let localNumber = cleaned
    if (localNumber.startsWith('234')) {
      localNumber = localNumber.slice(3)
    } else if (localNumber.startsWith('0')) {
      localNumber = localNumber.slice(1)
    }
    if (localNumber.length === 10) {
      const part1 = localNumber.slice(0, 3)
      const part2 = localNumber.slice(3, 6)
      const part3 = localNumber.slice(6)
      return `(+234) ${part1}-${part2}-${part3}`
    }
    return `(+234) ${localNumber}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'N/A'
    }
  }

  const formatForInput = (dateString) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      const pad = (num) => String(num).padStart(2, '0')
      const yyyy = date.getFullYear()
      const mm = pad(date.getMonth() + 1)
      const dd = pad(date.getDate())
      const hh = pad(date.getHours())
      const min = pad(date.getMinutes())
      return `${yyyy}-${mm}-${dd}T${hh}:${min}`
    } catch {
      return ''
    }
  }

  const getStatusConfig = (status) => {
    const configs = {
      'In Transit': { color: 'text-blue-400 border-blue-500/30 bg-blue-500/10', icon: Clock },
      'Delayed': { color: 'text-red-400 border-red-500/30 bg-red-500/10', icon: AlertTriangle },
      'Delivered (On Time)': { color: 'text-green-400 border-green-500/30 bg-green-500/10', icon: CheckCircle2 },
      'Delivered (Late)': { color: 'text-orange-400 border-orange-500/30 bg-orange-500/10', icon: AlertTriangle },
      'Draft': { color: 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10', icon: FileText }
    }
    return configs[status] || { color: 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10', icon: FileText }
  }

  // Edit transition
  const handleStartEdit = () => {
    setEditWaybill(order.waybill_number || '')
    setEditInvoice(order.invoice_number || '')
    setEditDriver(order.driver_name || '')
    setEditVehicle(order.vehicle_number || '')
    setEditDispatchTime(formatForInput(order.dispatch_time))
    setEditExpectedDelivery(formatForInput(order.expected_delivery_time))
    setEditActualDelivery(formatForInput(order.actual_delivery_time))
    setEditNotes(order.notes || '')
    setEditLineItems(order.line_items.map(item => ({
      product_id: item.product_id.toString(),
      searchQuery: item.product_name || '',
      quantity: item.quantity,
      unit: item.unit
    })))
    setCommitMessage('')
    setIsEditing(true)
    fetchProducts()
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const handleAddLineItem = () => {
    setEditLineItems([...editLineItems, { product_id: '', searchQuery: '', quantity: 1, unit: 'Carton' }])
  }

  const handleRemoveLineItem = (idx) => {
    if (editLineItems.length === 1) return
    setEditLineItems(editLineItems.filter((_, i) => i !== idx))
  }

  const getProductRate = (productId) => {
    if (!productId) return 0.0
    const prod = products.find(p => p.id === parseInt(productId))
    return prod ? prod.unit_price : 0.0
  }

  const handleSaveEdit = async () => {
    if (!editDispatchTime || !editExpectedDelivery) {
      alert("Please specify dispatch and expected delivery times.")
      return
    }

    const invalidItem = editLineItems.find(item => !item.product_id || item.quantity <= 0)
    if (invalidItem) {
      alert("Please select a valid product and quantity for all ledger items.")
      return
    }

    try {
      setLoading(true)
      const payload = {
        customer_id: order.customer_id,
        waybill_number: editWaybill || null,
        invoice_number: editInvoice || null,
        dispatch_time: new Date(editDispatchTime).toISOString(),
        expected_delivery_time: new Date(editExpectedDelivery).toISOString(),
        actual_delivery_time: editActualDelivery ? new Date(editActualDelivery).toISOString() : null,
        driver_name: editDriver || null,
        vehicle_number: editVehicle || null,
        notes: editNotes || null,
        line_items: editLineItems.map(item => ({
          product_id: parseInt(item.product_id),
          quantity: parseFloat(item.quantity),
          unit: item.unit
        })),
        commit_message: commitMessage.trim() || "Updated manifest details"
      }

      await api.put(`/orders/${id}`, payload)
      setIsEditing(false)
      await fetchOrderDetails()
    } catch (err) {
      console.error("Failed to save changes:", err)
      alert(err.response?.data?.detail || "Failed to save manifest details.")
    } finally {
      setLoading(false)
    }
  }

  // Revert implementation
  const handleRevert = async (log, detailsObj) => {
    if (!detailsObj || !detailsObj.state_snapshot) {
      alert("This commit does not contain a snapshot of the order state.")
      return
    }

    const snapshot = detailsObj.state_snapshot
    const shortHash = detailsObj.commit_hash || `log-${log.id}`

    if (!window.confirm(`Are you sure you want to revert this order's specification and ledger to commit [${shortHash}]?`)) {
      return
    }

    try {
      setLoading(true)
      const payload = {
        customer_id: snapshot.customer_id,
        waybill_number: snapshot.waybill_number || null,
        invoice_number: snapshot.invoice_number || null,
        dispatch_time: snapshot.dispatch_time,
        expected_delivery_time: snapshot.expected_delivery_time,
        actual_delivery_time: snapshot.actual_delivery_time || null,
        driver_name: snapshot.driver_name || null,
        vehicle_number: snapshot.vehicle_number || null,
        notes: snapshot.notes || null,
        line_items: snapshot.line_items.map(item => ({
          product_id: parseInt(item.product_id),
          quantity: parseFloat(item.quantity),
          unit: item.unit
        })),
        commit_message: `Reverted to commit [${shortHash}]`
      }

      await api.put(`/orders/${id}`, payload)
      await fetchOrderDetails()
      alert(`Successfully reverted order to commit [${shortHash}]!`)
    } catch (err) {
      console.error("Failed to revert order:", err)
      setError("Failed to revert order to previous commit. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-zinc-400">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mb-4"></div>
        <p className="text-sm">Fetching manifest details...</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
        <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
        <p className="text-zinc-300 font-semibold text-lg">{error || "Order not found"}</p>
        <Link
          to="/orders"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all"
        >
          <ArrowLeft size={16} /> Back to Orders
        </Link>
      </div>
    )
  }

  const statusConfig = getStatusConfig(order.order_status)
  const StatusIcon = statusConfig.icon

  return (
    <div className={`animate-in fade-in duration-300 max-w-7xl mx-auto ${isEditing ? 'pb-32' : 'pb-12'}`}>
      {/* Navigation & Actions Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-3 text-sm"
          >
            <ArrowLeft size={16} /> Back to Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white">{order.order_number}</h1>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.color}`}>
              <StatusIcon size={12} />
              {order.order_status}
            </span>
          </div>
        </div>
        <div className="flex flex-col md:items-end gap-2">
          {!isEditing && (
            <button
              onClick={handleStartEdit}
              className="px-4 py-2 border border-zinc-750 hover:border-white bg-transparent hover:bg-white text-zinc-300 hover:text-zinc-900 font-semibold rounded-xl transition-all duration-200 text-sm flex items-center gap-2"
            >
              <Edit3 size={14} />
              Edit Manifest & Ledger
            </button>
          )}
          <div className="text-xs text-zinc-500 font-mono">
            Created: {formatDate(order.created_at)}
          </div>
        </div>
      </div>

      {/* Transit Route Progress Visualizer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 shadow-xl">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Truck size={16} className="text-zinc-500" />
          Fulfillment Route Pipeline
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* Departure and Connective Pipeline */}
          <div className="lg:col-span-2 flex flex-col sm:flex-row gap-6 items-center justify-between">
            {/* Departure */}
            <div className="flex-1 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/80 flex items-start gap-3 w-full">
              <div className="p-2 bg-zinc-900 rounded-lg text-zinc-400">
                <MapPin size={18} />
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Departure Port</span>
                <span className="text-sm text-white font-bold block mt-0.5">Agege Warehouse</span>
                <span className="text-xs text-zinc-400 block mt-0.5">Agege, Lagos State</span>
              </div>
            </div>

            {/* Connective pipeline bar */}
            <div className="flex flex-col items-center justify-center px-4 relative shrink-0">
              <div className="text-[13px] font-mono font-bold text-zinc-400 uppercase tracking-[0.25em] mb-3">Transit</div>
              <div className="text-red-500 flex items-center justify-center w-full">
                <svg className="w-32 h-6" fill="none" viewBox="0 0 128 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h120M114 5l10 7-10 7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Destination */}
          <div className="lg:col-span-1 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/80 flex items-start gap-3">
            <div className="p-2 bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.25)] border border-white/20 rounded-lg">
              <MapPin size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Destination Address</span>
              <span className="text-sm text-white font-bold block mt-0.5 truncate" title={order.customer_address}>
                {order.customer_address || "No Address Registry"}
              </span>
              <span className="text-xs text-zinc-400 block mt-0.5">
                {order.customer_state || "N/A"} State, Nigeria
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Details Ledger and Audit log section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column (Main Information) */}
        <div className="lg:col-span-2 space-y-8">

          {/* Order Details Manifest Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6 flex items-center gap-2">
              <FileText size={16} className="text-zinc-500" />
              Manifest Specifications
            </h3>

            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-450 mb-1">Waybill Number</label>
                  <input
                    type="text"
                    value={editWaybill}
                    onChange={(e) => setEditWaybill(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-850 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-455 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={editInvoice}
                    onChange={(e) => setEditInvoice(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-855 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-450 mb-1">Driver Name</label>
                  <input
                    type="text"
                    value={editDriver}
                    onChange={(e) => setEditDriver(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-850 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-455 mb-1">Vehicle Registration</label>
                  <input
                    type="text"
                    value={editVehicle}
                    onChange={(e) => setEditVehicle(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-855 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-450 mb-1">Dispatch Departure *</label>
                  <input
                    type="datetime-local"
                    value={editDispatchTime}
                    onChange={(e) => setEditDispatchTime(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-850 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-455 mb-1">Expected Arrival *</label>
                  <input
                    type="datetime-local"
                    value={editExpectedDelivery}
                    onChange={(e) => setEditExpectedDelivery(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-855 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-450 mb-1">Actual Delivery Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={editActualDelivery}
                    onChange={(e) => setEditActualDelivery(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-850 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-450 mb-1">Transit Manifest Notes</label>
                  <textarea
                    rows="3"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-850 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <span className="text-xs text-zinc-500 font-medium block">Waybill Number</span>
                  <span className="text-sm text-white font-mono font-semibold block mt-1">
                    {order.waybill_number || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 font-medium block">Invoice Number</span>
                  <span className="text-sm text-white font-mono font-semibold block mt-1">
                    {order.invoice_number || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 font-medium block">Driver Name</span>
                  <span className="text-sm text-white font-semibold block mt-1">
                    {order.driver_name || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 font-medium block">Vehicle Registration</span>
                  <span className="text-sm text-white font-mono font-semibold block mt-1">
                    {order.vehicle_number || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 font-medium block">Dispatch Departure</span>
                  <span className="text-sm text-white block mt-1">
                    {formatDate(order.dispatch_time)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 font-medium block">Expected Arrival</span>
                  <span className="text-sm text-white block mt-1">
                    {formatDate(order.expected_delivery_time)}
                  </span>
                </div>
                {order.actual_delivery_time && (
                  <div>
                    <span className="text-xs text-zinc-500 font-medium block">Actual Delivery Time</span>
                    <span className="text-sm text-green-400 font-semibold block mt-1">
                      {formatDate(order.actual_delivery_time)}
                    </span>
                  </div>
                )}
                {order.delivery_duration !== null && (
                  <div>
                    <span className="text-xs text-zinc-500 font-medium block">Delivery Timeframe</span>
                    <span className="text-sm text-white block mt-1">
                      {order.delivery_duration} hours
                    </span>
                  </div>
                )}
              </div>
            )}

            {!isEditing && order.notes && (
              <div className="mt-6 pt-6 border-t border-zinc-800/80">
                <span className="text-xs text-zinc-500 font-medium block mb-2">Transit Manifest Notes</span>
                <div className="bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-3 text-xs text-zinc-300 leading-relaxed font-sans">
                  {order.notes}
                </div>
              </div>
            )}
          </div>

          {/* Product Ledger Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <DollarSign size={16} className="text-zinc-500" />
                Consignment Ledger
              </h3>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="flex items-center gap-1 px-2.5 py-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold rounded-lg border border-zinc-800 transition-colors"
                >
                  <Plus size={12} /> Add Product Item
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                {editLineItems.map((item, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-zinc-950/30 p-3 rounded-xl border border-zinc-850">
                    <div className="flex-1 w-full relative product-search-container">
                      <label className="block text-[10px] font-semibold text-zinc-500 mb-1 md:hidden">Product</label>
                      <input
                        type="text"
                        placeholder="Type product name..."
                        required
                        value={item.searchQuery || ''}
                        onFocus={() => {
                          setActiveProductSearchIndex(idx)
                        }}
                        onChange={(e) => {
                          const val = e.target.value
                          const updated = [...editLineItems]
                          updated[idx].searchQuery = val

                          const exactProd = products.find(p => p.name.toLowerCase() === val.trim().toLowerCase())
                          if (exactProd) {
                            updated[idx].product_id = exactProd.id.toString()
                          } else {
                            updated[idx].product_id = ''
                          }
                          setEditLineItems(updated)
                        }}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors text-sm"
                      />
                      
                      {activeProductSearchIndex === idx && (
                        <ProductSearchDropdown
                          query={item.searchQuery || ''}
                          products={products}
                          onSelect={(product) => {
                            const updated = [...editLineItems]
                            updated[idx].product_id = product.id.toString()
                            updated[idx].searchQuery = product.name
                            setEditLineItems(updated)
                            setActiveProductSearchIndex(null)
                          }}
                        />
                      )}
                    </div>

                    <div className="w-full md:w-28">
                      <label className="block text-[10px] font-semibold text-zinc-500 mb-1 md:hidden">Quantity</label>
                      <input
                        type="number"
                        required
                        min="1"
                        step="any"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...editLineItems]
                          updated[idx].quantity = e.target.value
                          setEditLineItems(updated)
                        }}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm"
                      />
                    </div>

                    <div className="w-full md:w-32">
                      <label className="block text-[10px] font-semibold text-zinc-500 mb-1 md:hidden">Unit</label>
                      <select
                        value={item.unit}
                        onChange={(e) => {
                          const updated = [...editLineItems]
                          updated[idx].unit = e.target.value
                          setEditLineItems(updated)
                        }}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm"
                      >
                        <option value="Carton">Carton</option>
                        <option value="Keg">Keg</option>
                        <option value="Bag">Bag</option>
                        <option value="Sachet">Sachet</option>
                      </select>
                    </div>

                    <div className="text-right px-2 py-2 text-xs text-zinc-500 font-mono hidden md:block">
                      Rate: {formatCurrency(getProductRate(item.product_id))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(idx)}
                      disabled={editLineItems.length === 1}
                      className="p-2 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors flex-shrink-0"
                      title="Remove Item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-850 bg-zinc-950/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Product Specification</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">Unit Type</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-400">Quantity</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-400">Rate</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-400">Line Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850">
                    {order.line_items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-850/10 transition-colors">
                        <td className="px-4 py-4 text-sm font-bold text-white">{item.product_name}</td>
                        <td className="px-4 py-4 text-sm text-right text-zinc-400 capitalize">{item.unit}</td>
                        <td className="px-4 py-4 text-sm text-center text-zinc-300 font-mono">{item.quantity}</td>
                        <td className="px-4 py-4 text-sm text-center text-zinc-400" style={{ fontFamily: '"Lora", Georgia, serif' }}>{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-4 text-sm text-center text-white font-semibold" style={{ fontFamily: '"Lora", Georgia, serif' }}>{formatCurrency(item.total_price || (item.unit_price * item.quantity))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Total Section */}
            <div className="mt-6 pt-6 border-t border-zinc-800 flex justify-between items-center bg-zinc-950/40 p-4 rounded-xl border border-zinc-850">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Invoice Sum Total</span>
              <span className="text-2xl font-extrabold text-green-400" style={{ fontFamily: '"Lora", Georgia, serif' }}>
                {isEditing ? (
                  formatCurrency(editLineItems.reduce((acc, item) => acc + (getProductRate(item.product_id) * (parseFloat(item.quantity) || 0)), 0))
                ) : (
                  formatCurrency(order.total_amount)
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar Information) */}
        <div className="space-y-8">

          {/* Customer registry details */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6 flex items-center gap-2">
              <User size={16} className="text-zinc-500" />
              Customer Registry
            </h3>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Company Name</span>
                <span className="text-sm font-bold text-white block mt-0.5">{order.customer_name}</span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Fulfillment State</span>
                <span className="text-sm text-zinc-300 block mt-0.5">{order.customer_state || 'N/A'}</span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Contact Email</span>
                <span className="text-sm text-zinc-300 block mt-0.5 font-mono truncate">{order.customer?.email || 'N/A'}</span>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Direct Phone Line</span>
                <span className="text-sm text-zinc-300 block mt-0.5 font-mono">{formatPhoneNumber(order.customer?.contact_number)}</span>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Registrar</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-cyan-950 flex items-center justify-center text-[10px] font-bold text-cyan-400 uppercase">
                    {order.created_by_name ? order.created_by_name.substring(0, 2) : "OP"}
                  </div>
                  <span className="text-xs text-zinc-400 font-semibold">{order.created_by_name || "System Operator"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Log Timeline (Git Commits History) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Activity size={16} className="text-zinc-500" />
              Manifest Audit Trail
            </h3>

            {auditLogs.length === 0 ? (
              <div className="flex items-center gap-2 text-zinc-500 bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/80 text-xs">
                <Info size={14} />
                <span>No audit events registered.</span>
              </div>
            ) : (
              <div className="relative pl-4 border-l-2 border-zinc-800 space-y-6 py-2">
                {auditLogs.map((log, idx) => {
                  let detailsObj = null
                  try {
                    detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details
                  } catch (e) {
                    // fallback
                  }

                  return (
                    <div key={idx} className="relative">
                      {/* timeline node dot */}
                      <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-cyan-500 ring-4 ring-zinc-900" />

                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-bold text-white capitalize leading-normal">
                            {detailsObj?.action || log.action.replace(/_/g, ' ')}
                          </div>
                          {detailsObj?.commit_hash && (
                            <span className="text-[10px] bg-zinc-800 border border-zinc-700/60 px-1.5 py-0.5 rounded font-mono text-zinc-400 shrink-0">
                              {detailsObj.commit_hash}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-550 font-mono">
                          {formatDate(log.timestamp)}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-1 leading-normal">
                          By <span className="text-zinc-300 font-semibold">{log.user_name || "Operator"}</span>
                        </div>
                        {detailsObj?.state_snapshot && (
                          <button
                            onClick={() => handleRevert(log, detailsObj)}
                            className="mt-2 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 self-start"
                          >
                            ↺ Revert to this commit
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Save Commit Bar */}
      {isEditing && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800 py-4 px-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_-8px_30px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom duration-300">
          <div className="flex-1 w-full md:max-w-xl">
            <input
              type="text"
              placeholder="Git commit message (e.g. Adjusted Wyldox quantity to 24)..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors text-sm font-semibold"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 border border-zinc-800 hover:border-red-500 hover:bg-red-500 text-zinc-300 hover:text-white font-medium rounded-xl transition-all duration-200 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="px-5 py-2 border border-zinc-750 hover:border-white bg-transparent hover:bg-white text-zinc-300 hover:text-zinc-900 font-semibold rounded-xl transition-all duration-200 text-sm"
            >
              Save Commit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
