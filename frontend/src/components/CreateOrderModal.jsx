import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Calendar, User, Package, FileText, Truck, AlertCircle } from 'lucide-react'
import api, { getWithCache } from '../services/api'

// Dropdown component for fuzzy product search
const ProductSearchDropdown = ({ query, products, onSelect }) => {
  // Filter products matching query case-insensitively
  const filtered = products
    .filter(p => p.name.toLowerCase().includes(query.toLowerCase()))

  if (filtered.length === 0) return null

  return (
    <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-850 border border-zinc-700/80 rounded-xl shadow-xl z-50 max-h-[132px] overflow-y-auto custom-product-dropdown-scroll backdrop-blur-md">
      <ul className="divide-y divide-zinc-800">
        {filtered.map((product) => (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => onSelect(product)}
              className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-700/55 transition-colors flex justify-between items-center"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-zinc-100">{product.name}</span>
                {product.brand && (
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    product.brand.toUpperCase() === 'DSLP'
                      ? 'bg-purple-500/25 text-purple-400 border border-purple-500/35'
                      : 'bg-sky-500/25 text-sky-400 border border-sky-500/35'
                  }`}>
                    {product.brand}
                  </span>
                )}
              </div>
              {product.category && (
                <span className="text-[10px] text-zinc-400 font-semibold px-2 py-0.5 bg-zinc-800 rounded uppercase tracking-wider">
                  {product.category}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const searchCustomersLocally = (query, customersList) => {
  if (!query) return []
  const queryLower = query.toLowerCase().trim()
  const queryWords = queryLower.split(/\s+/).filter(Boolean)
  
  return customersList
    .map(c => {
      const nameLower = c.name.toLowerCase()
      let score = 0
      
      // 1. Starts with query
      if (nameLower.startsWith(queryLower)) {
        score += 5
      }
      
      // 2. Any word starts with query
      const words = nameLower.split(/\s+/)
      if (words.some(w => w.startsWith(queryLower))) {
        score += 3
      }
      
      // 3. Substring match
      if (nameLower.includes(queryLower)) {
        score += 2
      }
      
      // 4. Any query word matches any customer name word
      if (queryWords.length > 0 && queryWords.every(qw => nameLower.includes(qw))) {
        score += 1.5
      }
      
      return { customer: c, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.customer.name.localeCompare(b.customer.name))
    .map(item => item.customer)
}

export default function CreateOrderModal({ isOpen, onClose }) {
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [centralStoreId, setCentralStoreId] = useState('')

  const createInitialOrderObject = (defaultSourceId = '') => ({
    id: Math.random().toString(36).substr(2, 9),
    customerId: '',
    customerSearchQuery: '',
    customerState: '',
    customerCity: '',
    matchingCustomers: [],
    showCustomerDropdown: false,
    pipelineType: '2-node', // '2-node' (direct regional to customer) or '3-node' (central to regional to customer)
    regionalStoreId: '', // selected regional store ID
    sourceStoreId: defaultSourceId,
    destinationStoreId: '',
    waybillNumber: '',
    invoiceNumber: '',
    dispatchTime: '',
    expectedDeliveryTime: '',
    deliveryTimeError: '',
    driverName: '',
    vehicleNumber: '',
    fuelCost: '0',
    waybillCost: '0',
    otherCosts: [],
    notes: '',
    lineItems: [
      { product_id: '', quantity: 1, unit: 'Carton', searchQuery: '' }
    ]
  })

  // Batch Form State
  const [batchOrders, setBatchOrders] = useState([createInitialOrderObject()])
  
  // Track active product search: { orderId, itemIdx }
  const [activeProductSearch, setActiveProductSearch] = useState(null)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.product-search-container')) {
        setActiveProductSearch(null)
      }
      if (!e.target.closest('.customer-search-container')) {
        setBatchOrders(prev => prev.map(o => ({ ...o, showCustomerDropdown: false })))
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      fetchFormData()
    }
  }, [isOpen])

  const fetchFormData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [productsRes, customersRes, storesRes] = await Promise.all([
        getWithCache('/products', { params: { limit: 1000 } }),
        getWithCache('/customers', { params: { limit: 1000 } }),
        getWithCache('/stores')
      ])
      const fetchedProducts = productsRes.data.items || productsRes.data || []
      const fetchedCustomers = customersRes.data.items || customersRes.data || []
      const fetchedStores = storesRes.data || []
      setProducts(fetchedProducts)
      setCustomers(fetchedCustomers)
      setStores(fetchedStores)

      const centralStore = fetchedStores.find(s => s.is_central)
      const centralStoreIdStr = centralStore ? centralStore.id.toString() : ''
      setCentralStoreId(centralStoreIdStr)

      // Initialize searchQuery for line items if pre-selected, and also resolve customer search typed during load
      setBatchOrders(prevOrders => prevOrders.map(order => {
        const updatedLineItems = order.lineItems.map(item => {
          if (item.product_id && !item.searchQuery) {
            const prod = fetchedProducts.find(p => p.id === parseInt(item.product_id))
            return { ...item, searchQuery: prod ? prod.name : '' }
          }
          return item
        })

        // If they typed something while loading, match it now
        const matched = order.customerSearchQuery
          ? searchCustomersLocally(order.customerSearchQuery, fetchedCustomers)
          : []

        return {
          ...order,
          sourceStoreId: order.sourceStoreId || centralStoreIdStr,
          lineItems: updatedLineItems,
          matchingCustomers: matched.slice(0, 4),
          showCustomerDropdown: order.customerSearchQuery ? true : order.showCustomerDropdown
        }
      }))
    } catch (err) {
      console.error('Failed to load form data:', err)
      setError('Failed to load form data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Add another order card to batch
  const handleAddOrder = () => {
    const centralStore = stores.find(s => s.is_central)
    const centralStoreId = centralStore ? centralStore.id.toString() : ''
    setBatchOrders([...batchOrders, createInitialOrderObject(centralStoreId)])
  }

  // Remove order card from batch
  const handleRemoveOrder = (id) => {
    if (batchOrders.length === 1) return
    setBatchOrders(batchOrders.filter(o => o.id !== id))
  }

  // Copy logistics details from one order to all others in the batch
  const handleCopyLogistics = (sourceOrder) => {
    setBatchOrders(batchOrders.map(o => {
      if (o.id === sourceOrder.id) return o
      return {
        ...o,
        sourceStoreId: sourceOrder.sourceStoreId,
        destinationStoreId: sourceOrder.destinationStoreId,
        dispatchTime: sourceOrder.dispatchTime,
        expectedDeliveryTime: sourceOrder.expectedDeliveryTime,
        driverName: sourceOrder.driverName,
        vehicleNumber: sourceOrder.vehicleNumber,
        fuelCost: sourceOrder.fuelCost,
        waybillCost: sourceOrder.waybillCost,
        otherCosts: sourceOrder.otherCosts.map(c => ({ ...c, id: Math.random().toString(36).substr(2, 9) })),
        deliveryTimeError: ''
      }
    }))
  }

  // Fuzzy search customers scoped to specific order index
  const handleCustomerSearch = (orderId, query) => {
    const matched = searchCustomersLocally(query, customers)
    setBatchOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          customerSearchQuery: query,
          customerId: '',
          showCustomerDropdown: true,
          matchingCustomers: matched.slice(0, 4)
        }
      }
      return o
    }))
  }

  // Select customer from dropdown scoped to specific order
  const handleSelectCustomer = (orderId, customer) => {
    setBatchOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          customerId: customer.id.toString(),
          customerSearchQuery: customer.name,
          customerState: customer.state || '',
          customerCity: customer.city || '',
          showCustomerDropdown: false,
          matchingCustomers: []
        }
      }
      return o
    }))
  }

  const handleRoutingChange = (orderId, updates) => {
    setBatchOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const merged = { ...o, ...updates }
        let sourceId = merged.sourceStoreId
        let destId = merged.destinationStoreId
        
        if (merged.pipelineType === '2-node') {
          sourceId = merged.regionalStoreId
          destId = ''
        } else if (merged.pipelineType === '3-node') {
          sourceId = centralStoreId
          destId = merged.regionalStoreId
        }
        
        return {
          ...merged,
          sourceStoreId: sourceId,
          destinationStoreId: destId
        }
      }
      return o
    }))
  }

  // Add line item inside a specific order
  const handleAddLineItem = (orderId) => {
    setBatchOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          lineItems: [...o.lineItems, { product_id: '', quantity: 1, unit: 'Carton', searchQuery: '' }]
        }
      }
      return o
    }))
  }

  // Remove line item inside a specific order
  const handleRemoveLineItem = (orderId, itemIndex) => {
    setBatchOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        if (o.lineItems.length === 1) return o
        return {
          ...o,
          lineItems: o.lineItems.filter((_, idx) => idx !== itemIndex)
        }
      }
      return o
    }))
  }

  // Update line item details inside a specific order
  const handleLineItemChange = (orderId, itemIndex, field, value) => {
    setBatchOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const updatedItems = o.lineItems.map((item, idx) => {
          if (idx === itemIndex) {
            const newItem = { ...item, [field]: value }
            if (field === 'searchQuery' && !value) {
              newItem.product_id = ''
            }
            return newItem
          }
          return item
        })
        return { ...o, lineItems: updatedItems }
      }
      return o
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate each order
    for (let i = 0; i < batchOrders.length; i++) {
      const order = batchOrders[i]
      const orderLabel = batchOrders.length > 1 ? `Order #${i + 1}` : 'The order'
      
      if (!order.customerId) {
        setError(`Please select a customer for ${orderLabel}.`)
        return
      }
      if (!order.regionalStoreId) {
        setError(`Please select a regional store for ${orderLabel} to define the fulfillment route pipeline.`)
        return
      }
      if (!order.dispatchTime || !order.expectedDeliveryTime) {
        setError(`Please specify dispatch and expected delivery times for ${orderLabel}.`)
        return
      }
      if (order.deliveryTimeError) {
        setError(`Please resolve delivery time issue for ${orderLabel}: ${order.deliveryTimeError}`)
        return
      }
      
      // Validate line items
      const invalidItem = order.lineItems.find(item => !item.product_id || item.quantity <= 0)
      if (invalidItem) {
        setError(`Please select a product and valid quantity for all line items in ${orderLabel}.`)
        return
      }
    }

    try {
      setSubmitting(true)
      setError(null)

      // Send all POST requests concurrently
      const requests = batchOrders.map(order => {
        const payload = {
          customer_id: parseInt(order.customerId),
          source_store_id: order.sourceStoreId ? parseInt(order.sourceStoreId) : null,
          destination_store_id: order.destinationStoreId ? parseInt(order.destinationStoreId) : null,
          waybill_number: order.waybillNumber || null,
          invoice_number: order.invoiceNumber || null,
          dispatch_time: new Date(order.dispatchTime).toISOString(),
          expected_delivery_time: new Date(order.expectedDeliveryTime).toISOString(),
          driver_name: order.driverName || null,
          vehicle_number: order.vehicleNumber || null,
          fuel_cost: parseFloat(order.fuelCost || 0),
          waybill_cost: parseFloat(order.waybillCost || 0),
          other_costs: order.otherCosts.map(c => ({ name: c.name, amount: parseFloat(c.amount || 0) })),
          notes: order.notes || null,
          line_items: order.lineItems.map(item => ({
            product_id: parseInt(item.product_id),
            quantity: parseFloat(item.quantity),
            unit: item.unit
          }))
        }
        return api.post('/orders', payload)
      })

      // Reset form & close modal immediately for optimistic instantaneous UI response
      const centralStore = stores.find(s => s.is_central)
      const centralStoreId = centralStore ? centralStore.id.toString() : ''
      setBatchOrders([createInitialOrderObject(centralStoreId)])
      onClose()

      // Await requests in the background
      Promise.all(requests)
        .then(() => {
          // Trigger order list refresh across the entire page
          window.dispatchEvent(new Event('order-created'))
        })
        .catch(err => {
          console.error('Failed to create orders batch in background:', err)
        })
        .finally(() => {
          setSubmitting(false)
        })
    } catch (err) {
      console.error('Failed to initiate orders batch creation:', err)
      setError(err.response?.data?.detail || 'Failed to initiate order creation. Please check your data and try again.')
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onWheel={(e) => e.stopPropagation()}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 shadow-2xl animate-in scale-in duration-200">

        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <Plus size={18} className="text-white" />
            </div>
            <h3 className="text-xl font-bold text-white">
              {batchOrders.length > 1 ? `Create Batch Orders (${batchOrders.length})` : 'Create New Order'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-modal-scroll bg-zinc-900/20" style={{ overscrollBehavior: 'contain' }}>
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-400 text-sm">
              <AlertCircle size={20} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-6">
            {batchOrders.map((order, index) => (
              <div 
                key={order.id} 
                className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200"
              >
                {/* Header of each customer order card */}
                <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/40 px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 text-zinc-300 text-xs font-bold border border-zinc-700">
                      {index + 1}
                    </span>
                    <h5 className="font-bold text-white text-sm">
                      {order.customerSearchQuery ? `Order for: ${order.customerSearchQuery}` : 'New Customer Order'}
                    </h5>
                  </div>
                  {batchOrders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOrder(order.id)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-red-400 px-2 py-1 rounded bg-zinc-800/30 hover:bg-red-500/10 border border-zinc-850 transition-all"
                      title="Remove Order from Batch"
                    >
                      <Trash2 size={13} />
                      Remove
                    </button>
                  )}
                </div>

                {/* Form Fields container */}
                <div className="p-6 space-y-6">
                  {/* Step 1: Customer Details */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                      <User size={14} /> Customer Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative customer-search-container w-full">
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Customer <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Type customer name..."
                          required
                          value={order.customerSearchQuery}
                          onFocus={() => {
                            setBatchOrders(prev => prev.map(o => o.id === order.id ? { ...o, showCustomerDropdown: true } : o))
                          }}
                          onChange={(e) => handleCustomerSearch(order.id, e.target.value)}
                          className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors text-sm"
                        />
                        
                        {order.showCustomerDropdown && order.matchingCustomers.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-850 border border-zinc-700/80 rounded-xl shadow-xl z-50 overflow-hidden backdrop-blur-md">
                            <ul className="divide-y divide-zinc-800">
                              {order.matchingCustomers.map((c) => (
                                <li key={c.id}>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectCustomer(order.id, c)}
                                    className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-700/55 transition-colors flex justify-between items-center"
                                  >
                                    <span className="font-medium text-zinc-100">{c.name}</span>
                                    {c.state && <span className="text-xs text-zinc-400 font-semibold px-2 py-0.5 bg-zinc-800 rounded">{c.state}</span>}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Waybill #</label>
                          <input
                            type="text"
                            placeholder="e.g. WB-929"
                            value={order.waybillNumber}
                            onChange={(e) => {
                              setBatchOrders(prev => prev.map(o => o.id === order.id ? { ...o, waybillNumber: e.target.value } : o))
                            }}
                            className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Invoice #</label>
                          <input
                            type="text"
                            placeholder="e.g. INV-102"
                            value={order.invoiceNumber}
                            onChange={(e) => {
                              setBatchOrders(prev => prev.map(o => o.id === order.id ? { ...o, invoiceNumber: e.target.value } : o))
                            }}
                            className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 1.5: Fulfillment Route Pipeline */}
                  <div className="space-y-4 pt-4 border-t border-zinc-850">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                      <Truck size={14} /> Fulfillment Route Pipeline
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Regional Store Selector */}
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Regional Store <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={order.regionalStoreId || ''}
                          onChange={(e) => {
                            handleRoutingChange(order.id, { regionalStoreId: e.target.value })
                          }}
                          className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-650 transition-colors text-sm"
                        >
                          <option value="">-- Select Store --</option>
                          {stores.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} {s.is_central ? '(Central HQ)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Pipeline Type selector */}
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Routing Model
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-zinc-950/60 p-1 border border-zinc-800 rounded-xl">
                          <button
                            type="button"
                            onClick={() => handleRoutingChange(order.id, { pipelineType: '2-node' })}
                            className={`py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${
                              order.pipelineType === '2-node'
                                ? 'bg-zinc-850 text-emerald-400 shadow-md border border-zinc-700/50'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            2-Node Direct
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRoutingChange(order.id, { pipelineType: '3-node' })}
                            className={`py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${
                              order.pipelineType === '3-node'
                                ? 'bg-zinc-850 text-emerald-400 shadow-md border border-zinc-700/50'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            3-Node Supply
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Visual Routing Pipeline diagram */}
                    <div className="bg-zinc-950/40 border border-zinc-850/60 rounded-xl p-4 mt-3 flex flex-col items-center justify-center space-y-3 min-h-[90px] overflow-hidden">
                      <span className="text-[9px] uppercase tracking-widest text-zinc-550 font-bold">Route Path Preview</span>
                      
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm font-semibold w-full">
                        {order.pipelineType === '3-node' && (
                          <>
                            {/* Node 1: Lagos Central Store */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-center shadow-md flex-1 min-w-0 w-full">
                              <span className="text-[8px] uppercase tracking-wider text-zinc-550 font-bold block mb-0.5">Supply Source</span>
                              <span className="text-zinc-200 text-xs truncate block">Lagos Store (HQ)</span>
                            </div>
                            
                            {/* Supply arrow */}
                            <div className="flex flex-col items-center text-[9px] text-zinc-500 shrink-0 sm:rotate-0 rotate-90 my-1 sm:my-0">
                              <span className="font-bold tracking-wider text-amber-500/80 uppercase">Supply</span>
                              <div className="flex items-center text-zinc-600 text-[10px]">
                                <span>──➔</span>
                              </div>
                            </div>
                          </>
                        )}
                        
                        {/* Node 2: Regional Store */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-center shadow-md flex-1 min-w-0 w-full">
                          <span className="text-[8px] uppercase tracking-wider text-zinc-550 font-bold block mb-0.5">
                            {order.pipelineType === '3-node' ? 'Transfer Hub' : 'Departure Store'}
                          </span>
                          <span className="text-zinc-200 text-xs truncate block">
                            {stores.find(s => s.id.toString() === order.regionalStoreId)?.name || 'Select Store'}
                          </span>
                        </div>
 
                        {/* Delivery transit arrow */}
                        <div className="flex flex-col items-center text-[9px] text-zinc-500 shrink-0 sm:rotate-0 rotate-90 my-1 sm:my-0">
                          <span className="font-bold tracking-wider text-emerald-500/80 uppercase">Transit</span>
                          <div className="flex items-center text-zinc-600 text-[10px]">
                            <span>──➔</span>
                          </div>
                        </div>
 
                        {/* Node 3: Customer destination */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-center shadow-md flex-1 min-w-0 w-full">
                          <span className="text-[8px] uppercase tracking-wider text-zinc-550 font-bold block mb-0.5">Destination</span>
                          <span className="text-zinc-200 text-xs truncate block">
                            {order.customerSearchQuery || 'Customer'}
                          </span>
                          {(order.customerCity || order.customerState) && (
                            <span className="text-[9px] text-zinc-500 block truncate">
                              {order.customerCity ? `${order.customerCity}, ` : ''}{order.customerState}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Schedule & Delivery */}
                  <div className="space-y-4 pt-4 border-t border-zinc-850">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <Calendar size={14} /> Schedule & Logistics
                      </h4>
                      {batchOrders.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleCopyLogistics(order)}
                          className="text-[10px] font-bold text-zinc-400 hover:text-white bg-zinc-855 hover:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-800 transition-colors"
                          title="Copy this card's dispatch/driver info to all other cards"
                        >
                          Copy Logistics to All
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Dispatch Time <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={order.dispatchTime}
                          onChange={(e) => {
                            const val = e.target.value
                            setBatchOrders(prev => prev.map(o => {
                              if (o.id !== order.id) return o
                              const newTimeError = o.expectedDeliveryTime && new Date(o.expectedDeliveryTime) <= new Date(val)
                                ? 'Expected Delivery must be after Dispatch Time.'
                                : ''
                              return { ...o, dispatchTime: val, deliveryTimeError: newTimeError }
                            }))
                          }}
                          className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-650 transition-colors text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Expected Delivery <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={order.expectedDeliveryTime}
                          onChange={(e) => {
                            const val = e.target.value
                            setBatchOrders(prev => prev.map(o => {
                              if (o.id !== order.id) return o
                              const newTimeError = o.dispatchTime && new Date(val) <= new Date(o.dispatchTime)
                                ? 'Expected Delivery must be after Dispatch Time.'
                                : ''
                              return { ...o, expectedDeliveryTime: val, deliveryTimeError: newTimeError }
                            }))
                          }}
                          className={`w-full px-4 py-2 bg-zinc-950/60 border rounded-xl text-zinc-100 focus:outline-none transition-colors text-sm ${
                            order.deliveryTimeError ? 'border-red-500 focus:border-red-500' : 'border-zinc-800 focus:border-zinc-650'
                          }`}
                        />
                        {order.deliveryTimeError && (
                          <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                            <AlertCircle size={12} />
                            {order.deliveryTimeError}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Driver Name</label>
                        <div className="relative">
                          <Truck size={14} className="absolute left-3.5 top-3 text-zinc-550" />
                          <input
                            type="text"
                            placeholder="e.g. John Doe"
                            value={order.driverName}
                            onChange={(e) => {
                              setBatchOrders(prev => prev.map(o => o.id === order.id ? { ...o, driverName: e.target.value } : o))
                            }}
                            className="w-full pl-10 pr-4 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-650 transition-colors text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Vehicle License Number</label>
                        <input
                          type="text"
                          placeholder="e.g. KDS-288AA"
                          value={order.vehicleNumber}
                          onChange={(e) => {
                            setBatchOrders(prev => prev.map(o => o.id === order.id ? { ...o, vehicleNumber: e.target.value } : o))
                          }}
                          className="w-full px-4 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-650 transition-colors text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Line Items */}
                  <div className="space-y-4 pt-4 border-t border-zinc-850">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <Package size={14} /> Products & Line Items <span className="text-red-500">*</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleAddLineItem(order.id)}
                        className="flex items-center gap-1.5 px-3 py-1 bg-zinc-805 hover:bg-zinc-800 text-white hover:text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-800 transition-colors"
                      >
                        <Plus size={14} /> Add Product
                      </button>
                    </div>

                    <div className="space-y-3">
                      {order.lineItems.map((item, itemIdx) => (
                        <div 
                          key={itemIdx} 
                          className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-zinc-950/20 p-3 rounded-xl border border-zinc-800"
                        >
                          <div className="flex-1 w-full relative product-search-container">
                            <label className="block text-[10px] font-semibold text-zinc-500 mb-1 md:hidden">Product</label>
                            <input
                              type="text"
                              placeholder="Type product name..."
                              required
                              value={item.searchQuery || ''}
                              onFocus={() => {
                                setActiveProductSearch({ orderId: order.id, itemIdx })
                                if (!item.searchQuery && item.product_id) {
                                  const prod = products.find(p => p.id === parseInt(item.product_id))
                                  if (prod) {
                                    handleLineItemChange(order.id, itemIdx, 'searchQuery', prod.name)
                                  }
                                }
                              }}
                              onChange={(e) => handleLineItemChange(order.id, itemIdx, 'searchQuery', e.target.value)}
                              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-white transition-colors text-sm"
                            />
                            
                            {activeProductSearch?.orderId === order.id && activeProductSearch?.itemIdx === itemIdx && (
                              <ProductSearchDropdown
                                query={item.searchQuery || ''}
                                products={products}
                                onSelect={(product) => {
                                  handleLineItemChange(order.id, itemIdx, 'product_id', product.id.toString())
                                  handleLineItemChange(order.id, itemIdx, 'searchQuery', product.name)
                                  setActiveProductSearch(null)
                                }}
                              />
                            )}
                          </div>

                          <div className="w-full md:w-32">
                            <label className="block text-[10px] font-semibold text-zinc-500 mb-1 md:hidden">Quantity</label>
                            <input
                              type="number"
                              required
                              min="1"
                              step="any"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => handleLineItemChange(order.id, itemIdx, 'quantity', e.target.value)}
                              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-white transition-colors text-sm"
                            />
                          </div>

                          <div className="w-full md:w-36">
                            <label className="block text-[10px] font-semibold text-zinc-500 mb-1 md:hidden">Unit</label>
                            <select
                              value={item.unit}
                              onChange={(e) => handleLineItemChange(order.id, itemIdx, 'unit', e.target.value)}
                              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-white transition-colors text-sm"
                            >
                              <option value="Carton">Carton</option>
                              <option value="Keg">Keg</option>
                              <option value="Bag">Bag</option>
                              <option value="Sachet">Sachet</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(order.id, itemIdx)}
                            disabled={order.lineItems.length === 1}
                            className="p-2 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors flex-shrink-0"
                            title="Remove Item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Step 3.5: Logistics Costs */}
                  <div className="space-y-4 pt-4 border-t border-zinc-850">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="text-zinc-550 font-bold">$</span> Logistics Costs
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setBatchOrders(prev => prev.map(o => {
                            if (o.id !== order.id) return o
                            return {
                              ...o,
                              otherCosts: [
                                ...o.otherCosts,
                                { id: Math.random().toString(36).substr(2, 9), name: '', amount: '0' }
                              ]
                            }
                          }))
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white text-xs font-semibold rounded-lg border border-zinc-700 transition-colors"
                        title="Add Custom Cost Item"
                      >
                        <Plus size={13} />
                        Add Cost
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Fuel Cost (₦)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          step="any"
                          value={order.fuelCost}
                          onChange={(e) => {
                            setBatchOrders(prev => prev.map(o => o.id === order.id ? { ...o, fuelCost: e.target.value } : o))
                          }}
                          className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-zinc-650 transition-colors text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                          Waybill Cost (₦)
                        </label>
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          step="any"
                          value={order.waybillCost}
                          onChange={(e) => {
                            setBatchOrders(prev => prev.map(o => o.id === order.id ? { ...o, waybillCost: e.target.value } : o))
                          }}
                          className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-zinc-650 transition-colors text-sm"
                        />
                      </div>
                    </div>

                    {/* Custom Costs list */}
                    {order.otherCosts && order.otherCosts.length > 0 && (
                      <div className="space-y-3 pt-2">
                        {order.otherCosts.map((cost, costIdx) => (
                          <div key={cost.id} className="flex gap-3 items-center bg-zinc-950/30 p-3 rounded-xl border border-zinc-800 animate-in fade-in duration-200">
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder="Cost Name (e.g. Loading Fee)"
                                required
                                value={cost.name}
                                onChange={(e) => {
                                  setBatchOrders(prev => prev.map(o => {
                                    if (o.id !== order.id) return o
                                    const updatedCosts = [...o.otherCosts]
                                    updatedCosts[costIdx] = { ...updatedCosts[costIdx], name: e.target.value }
                                    return { ...o, otherCosts: updatedCosts }
                                  }))
                                }}
                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-550 focus:outline-none focus:border-white transition-colors text-sm"
                              />
                            </div>
                            <div className="w-32">
                              <input
                                type="number"
                                placeholder="Amount"
                                min="0"
                                step="any"
                                required
                                value={cost.amount}
                                onChange={(e) => {
                                  setBatchOrders(prev => prev.map(o => {
                                    if (o.id !== order.id) return o
                                    const updatedCosts = [...o.otherCosts]
                                    updatedCosts[costIdx] = { ...updatedCosts[costIdx], amount: e.target.value }
                                    return { ...o, otherCosts: updatedCosts }
                                  }))
                                }}
                                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-white transition-colors text-sm"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setBatchOrders(prev => prev.map(o => {
                                  if (o.id !== order.id) return o
                                  return { ...o, otherCosts: o.otherCosts.filter(c => c.id !== cost.id) }
                                }))
                              }}
                              className="p-2 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 rounded-lg transition-colors flex-shrink-0"
                              title="Remove Cost Item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Step 4: Notes */}
                  <div className="space-y-4 pt-4 border-t border-zinc-850">
                    <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                      <FileText size={14} /> Additional Notes
                    </h4>
                    <textarea
                      rows="2"
                      placeholder="Enter dispatch notes, specific customer requirements, etc."
                      value={order.notes}
                      onChange={(e) => {
                        setBatchOrders(prev => prev.map(o => o.id === order.id ? { ...o, notes: e.target.value } : o))
                      }}
                      className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-650 transition-colors text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Another Customer Button */}
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={handleAddOrder}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-white border border-zinc-800 hover:border-white text-white hover:text-zinc-900 font-semibold rounded-2xl shadow-lg transition-all duration-200"
            >
              <Plus size={18} />
              Add Another Customer Order
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between gap-3">
          <span className="text-xs text-zinc-500 font-semibold">
            {batchOrders.length} customer order{batchOrders.length > 1 ? 's' : ''} in batch
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-750 hover:border-red-500 hover:bg-red-500 text-zinc-300 hover:text-white font-medium rounded-xl transition-all duration-200 text-sm"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2 border border-zinc-750 hover:border-white bg-transparent hover:bg-white text-zinc-300 hover:text-zinc-900 font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm"
              disabled={submitting}
            >
              {submitting ? 'Creating Batch...' : batchOrders.length > 1 ? `Create Batch Orders (${batchOrders.length})` : 'Create Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
