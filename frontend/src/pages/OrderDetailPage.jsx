import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'
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
  Info
} from 'lucide-react'

export default function OrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchOrderDetails()
  }, [id])

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      
      // Fetch order details
      const orderRes = await api.get(`/orders/${id}`)
      setOrder(orderRes.data)
      
      // Fetch audit logs
      try {
        const auditRes = await api.get(`/orders/${id}/audit-log`)
        setAuditLogs(auditRes.data || [])
      } catch (auditErr) {
        console.error("Failed to load audit logs for order:", auditErr)
      }
      
      setError(null)
    } catch (err) {
      console.error("Failed to fetch order details:", err)
      setError("Failed to load order details. Please verify the order ID.")
    } finally {
      setLoading(false)
    }
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
    <div className="animate-in fade-in duration-300 max-w-7xl mx-auto pb-12">
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
        <div className="text-xs text-zinc-500 font-mono text-right md:self-end">
          Created: {formatDate(order.created_at)}
        </div>
      </div>

      {/* Transit Route Progress Visualizer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 shadow-xl">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Truck size={16} className="text-zinc-500" />
          Fulfillment Route Pipeline
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
          {/* Departure */}
          <div className="lg:col-span-2 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/80 flex items-start gap-3">
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
          <div className="flex flex-col items-center justify-center px-4 relative lg:col-span-1">
            <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase mb-2">Transit</div>
            <div className="w-full lg:w-24 h-[3px] bg-zinc-800 rounded-full relative">
              <div 
                className={`absolute left-0 top-0 bottom-0 rounded-full bg-cyan-500 transition-all duration-500 ${
                  order.order_status.startsWith('Delivered') ? 'w-full' : order.order_status === 'In Transit' ? 'w-1/2' : 'w-0'
                }`}
              />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t-2 border-r-2 border-zinc-600 rotate-45" />
            </div>
          </div>

          {/* Destination */}
          <div className="lg:col-span-2 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/80 flex items-start gap-3">
            <div className="p-2 bg-cyan-950/40 text-cyan-400 rounded-lg">
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

            {order.notes && (
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
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6 flex items-center gap-2">
              <DollarSign size={16} className="text-zinc-500" />
              Consignment Ledger
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-850 bg-zinc-950/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Product Specification</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">Unit Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-400">Line Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {order.line_items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-zinc-850/10 transition-colors">
                      <td className="px-4 py-4 text-sm font-bold text-white">{item.product_name}</td>
                      <td className="px-4 py-4 text-sm text-right text-zinc-400 capitalize">{item.unit}</td>
                      <td className="px-4 py-4 text-sm text-right text-zinc-300 font-mono">{item.quantity}</td>
                      <td className="px-4 py-4 text-sm text-right text-zinc-400 font-mono">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-4 text-sm text-right text-white font-semibold font-mono">{formatCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Section */}
            <div className="mt-6 pt-6 border-t border-zinc-800 flex justify-between items-center bg-zinc-950/40 p-4 rounded-xl border border-zinc-850">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Invoice Sum Total</span>
              <span className="text-2xl font-extrabold text-cyan-400 font-mono">{formatCurrency(order.total_amount)}</span>
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
                <span className="text-sm text-zinc-300 block mt-0.5 font-mono">{order.customer?.contact_number || 'N/A'}</span>
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

          {/* Audit Log Timeline */}
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
                {auditLogs.map((log, idx) => (
                  <div key={idx} className="relative">
                    {/* timeline node dot */}
                    <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-cyan-500 ring-4 ring-zinc-900" />
                    
                    <div className="flex flex-col gap-0.5">
                      <div className="text-xs font-bold text-white capitalize">
                        {log.action.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {formatDate(log.timestamp)}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-1 leading-normal">
                        By <span className="text-zinc-300 font-semibold">{log.user_name || "Operator"}</span>
                        {log.details && (
                          <div className="mt-1 text-[10px] text-zinc-500 bg-zinc-950/20 p-1.5 rounded font-mono border border-zinc-850">
                            {JSON.stringify(JSON.parse(log.details))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
