import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Calendar, User, Package, FileText, Truck, AlertCircle } from 'lucide-react'
import api from '../services/api'

// Dropdown component for fuzzy product search
const ProductSearchDropdown = ({ query, products, onSelect }) => {
  // Filter products matching query case-insensitively
  const filtered = products
    .filter(p => p.name.toLowerCase().includes(query.toLowerCase()))

  if (filtered.length === 0) return null

  return (
    <>
      <style>{`
        .custom-product-dropdown-scroll {
          scrollbar-width: thin;
          scrollbar-color: #ffffffff #27272a;
        }
        .custom-product-dropdown-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .custom-product-dropdown-scroll::-webkit-scrollbar-track {
          background: #27272a;
          border-radius: 0 12px 12px 0;
        }
        .custom-product-dropdown-scroll::-webkit-scrollbar-thumb {
          background: #ef4444;
          border-radius: 9999px;
        }
        .custom-product-dropdown-scroll::-webkit-scrollbar-thumb:hover {
          background: #dc2626;
        }
      `}</style>
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
    </>
  )
}

export default function CreateOrderModal({ isOpen, onClose }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Form State
  const [customerId, setCustomerId] = useState('')
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [matchingCustomers, setMatchingCustomers] = useState([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  
  const [waybillNumber, setWaybillNumber] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [dispatchTime, setDispatchTime] = useState('')
  const [expectedDeliveryTime, setExpectedDeliveryTime] = useState('')
  const [driverName, setDriverName] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState([
    { product_id: '', quantity: 1, unit: 'Carton', searchQuery: '' }
  ])
  const [activeProductSearchIndex, setActiveProductSearchIndex] = useState(null)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.product-search-container')) {
        setActiveProductSearchIndex(null)
      }
      if (!e.target.closest('.customer-search-container')) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  // Fuzzy search customers against database as user types
  useEffect(() => {
    if (!customerSearchQuery.trim()) {
      setMatchingCustomers([])
      return
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await api.get('/customers/search', { params: { q: customerSearchQuery } })
        // Return 3 closest customer names
        setMatchingCustomers(res.data.slice(0, 3) || [])
      } catch (err) {
        console.error('Failed to search customers:', err)
      }
    }, 200)

    return () => clearTimeout(delayDebounceFn)
  }, [customerSearchQuery])

  useEffect(() => {
    if (isOpen) {
      fetchFormData()
    }
  }, [isOpen])

  const fetchFormData = async () => {
    try {
      setLoading(true)
      setError(null)
      const productsRes = await api.get('/products', { params: { limit: 100 } })
      const fetchedProducts = productsRes.data.items || []
      setProducts(fetchedProducts)

      // Initialize searchQuery for line items if pre-selected
      setLineItems(prevItems => prevItems.map(item => {
        if (item.product_id && !item.searchQuery) {
          const prod = fetchedProducts.find(p => p.id === parseInt(item.product_id))
          return { ...item, searchQuery: prod ? prod.name : '' }
        }
        return item
      }))
    } catch (err) {
      console.error('Failed to load form data:', err)
      setError('Failed to load products. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { product_id: '', quantity: 1, unit: 'Carton', searchQuery: '' }])
  }

  const handleRemoveLineItem = (index) => {
    if (lineItems.length === 1) return
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const handleLineItemChange = (index, field, value) => {
    const newItems = [...lineItems]
    newItems[index][field] = value
    setLineItems(newItems)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!customerId || !dispatchTime || !expectedDeliveryTime) {
      setError('Please fill in all required fields.')
      return
    }

    const dispatchDate = new Date(dispatchTime)
    const expectedDate = new Date(expectedDeliveryTime)

    if (expectedDate <= dispatchDate) {
      setError('Expected Delivery Time must be after the Dispatch Time.')
      return
    }

    // Validate line items
    const invalidItem = lineItems.find(item => !item.product_id || item.quantity <= 0)
    if (invalidItem) {
      setError('Please select a product and valid quantity for all items.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const payload = {
        customer_id: parseInt(customerId),
        waybill_number: waybillNumber || null,
        invoice_number: invoiceNumber || null,
        dispatch_time: new Date(dispatchTime).toISOString(),
        expected_delivery_time: new Date(expectedDeliveryTime).toISOString(),
        driver_name: driverName || null,
        vehicle_number: vehicleNumber || null,
        notes: notes || null,
        line_items: lineItems.map(item => ({
          product_id: parseInt(item.product_id),
          quantity: parseFloat(item.quantity),
          unit: item.unit
        }))
      }

      await api.post('/orders', payload)

      // Trigger order list refresh
      window.dispatchEvent(new Event('order-created'))

      // Reset form
      setCustomerId('')
      setCustomerSearchQuery('')
      setMatchingCustomers([])
      setWaybillNumber('')
      setInvoiceNumber('')
      setDispatchTime('')
      setExpectedDeliveryTime('')
      setDriverName('')
      setVehicleNumber('')
      setNotes('')
      setLineItems([{ product_id: '', quantity: 1, unit: 'Carton', searchQuery: '' }])

      onClose()
    } catch (err) {
      console.error('Failed to create order:', err)
      setError(err.response?.data?.detail || 'Failed to create order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 shadow-2xl animate-in scale-in duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Plus size={18} className="text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Create New Order</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-400 text-sm">
              <AlertCircle size={20} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Customer Details */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <User size={16} /> Customer Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative customer-search-container w-full">
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Customer <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="Type customer name..."
                  required
                  value={customerSearchQuery}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value)
                    setCustomerId('')
                  }}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                  disabled={loading}
                />
                
                {showCustomerDropdown && matchingCustomers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-800 border border-zinc-700/80 rounded-xl shadow-xl z-50 overflow-hidden backdrop-blur-md">
                    <ul className="divide-y divide-zinc-750">
                      {matchingCustomers.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerId(c.id.toString())
                              setCustomerSearchQuery(c.name)
                              setShowCustomerDropdown(false)
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-700/50 transition-colors flex justify-between items-center"
                          >
                            <span className="font-medium text-zinc-100">{c.name}</span>
                            {c.state && <span className="text-xs text-zinc-400 font-semibold px-2 py-0.5 bg-zinc-750 rounded">{c.state}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Waybill #</label>
                  <input
                    type="text"
                    placeholder="e.g. WB-929"
                    value={waybillNumber}
                    onChange={(e) => setWaybillNumber(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Invoice #</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-102"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Schedule & Delivery */}
          <div className="space-y-4 pt-4 border-t border-zinc-800/80">
            <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Calendar size={16} /> Schedule & Logistics
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Dispatch Time <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  required
                  value={dispatchTime}
                  onChange={(e) => setDispatchTime(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Expected Delivery <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  required
                  value={expectedDeliveryTime}
                  onChange={(e) => setExpectedDeliveryTime(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Driver Name</label>
                <div className="relative">
                  <Truck size={16} className="absolute left-3.5 top-3 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="e.g. John Doe"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Vehicle License Number</label>
                <input
                  type="text"
                  placeholder="e.g. KDS-288AA"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Line Items */}
          <div className="space-y-4 pt-4 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Package size={16} /> Products & Line Items <span className="text-red-500">*</span>
              </h4>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-cyan-400 hover:text-cyan-300 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors"
              >
                <Plus size={14} /> Add Product
              </button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-zinc-800/20 p-3 rounded-xl border border-zinc-800">
                  <div className="flex-1 w-full relative product-search-container">
                    <label className="block text-[10px] font-semibold text-zinc-500 mb-1 md:hidden">Product</label>
                    <input
                      type="text"
                      placeholder="Type product name..."
                      required
                      value={item.searchQuery || ''}
                      onFocus={() => {
                        setActiveProductSearchIndex(index)
                        if (!item.searchQuery && item.product_id) {
                          const prod = products.find(p => p.id === parseInt(item.product_id))
                          if (prod) {
                            handleLineItemChange(index, 'searchQuery', prod.name)
                          }
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value
                        handleLineItemChange(index, 'searchQuery', val)
                        if (!val) {
                          handleLineItemChange(index, 'product_id', '')
                        } else {
                          const exactProd = products.find(p => p.name.toLowerCase() === val.trim().toLowerCase())
                          if (exactProd) {
                            handleLineItemChange(index, 'product_id', exactProd.id.toString())
                          }
                        }
                      }}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                      disabled={loading}
                    />
                    
                    {activeProductSearchIndex === index && (
                      <ProductSearchDropdown
                        query={item.searchQuery || ''}
                        products={products}
                        onSelect={(product) => {
                          handleLineItemChange(index, 'product_id', product.id.toString())
                          handleLineItemChange(index, 'searchQuery', product.name)
                          setActiveProductSearchIndex(null)
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
                      onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                    />
                  </div>

                  <div className="w-full md:w-36">
                    <label className="block text-[10px] font-semibold text-zinc-500 mb-1 md:hidden">Unit</label>
                    <select
                      value={item.unit}
                      onChange={(e) => handleLineItemChange(index, 'unit', e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                    >
                      <option value="Carton">Carton</option>
                      <option value="Keg">Keg</option>
                      <option value="Bag">Bag</option>
                      <option value="Sachet">Sachet</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveLineItem(index)}
                    disabled={lineItems.length === 1}
                    className="p-2 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors flex-shrink-0"
                    title="Remove Item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Step 4: Notes */}
          <div className="space-y-4 pt-4 border-t border-zinc-800/80">
            <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <FileText size={16} /> Additional Notes
            </h4>
            <textarea
              rows="3"
              placeholder="Enter dispatch notes, specific customer requirements, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-zinc-750 hover:bg-zinc-800 text-zinc-300 font-medium rounded-xl transition-colors text-sm"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-600/15 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Order'}
          </button>
        </div>
      </div>
    </div>
  )
}
