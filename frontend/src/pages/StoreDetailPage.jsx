import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  User, 
  Search, 
  ArrowUpDown, 
  Package, 
  Crown, 
  Factory, 
  Building2, 
  Edit3, 
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'

export default function StoreDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [store, setStore] = useState(null)
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStock, setFilterStock] = useState('all')
  const [sortBy, setSortBy] = useState('name-asc')
  
  const [adjustItem, setAdjustItem] = useState(null)
  const [adjustValue, setAdjustValue] = useState('')
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  const hasWriteAccess = user?.role === 'admin' || user?.has_write_access === true

  useEffect(() => {
    fetchStoreAndInventory()
  }, [id])

  const fetchStoreAndInventory = async () => {
    try {
      setLoading(true)
      const [storeRes, invRes] = await Promise.all([
        api.get(`/stores/${id}`),
        api.get(`/stores/${id}/inventory`)
      ])
      setStore(storeRes.data)
      setInventory(invRes.data || [])
    } catch (err) {
      console.error('Failed to load store registry details:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter & Sort Inventory items
  const filteredInventory = useMemo(() => {
    let result = [...inventory]

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(item => 
        item.product_name.toLowerCase().includes(q)
      )
    }

    // Stock state filter
    if (filterStock === 'in') {
      result = result.filter(item => item.stock > 15)
    } else if (filterStock === 'low') {
      result = result.filter(item => item.stock > 0 && item.stock <= 15)
    } else if (filterStock === 'out') {
      result = result.filter(item => item.stock === 0)
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'name-asc') return a.product_name.localeCompare(b.product_name)
      if (sortBy === 'name-desc') return b.product_name.localeCompare(a.product_name)
      if (sortBy === 'stock-desc') return b.stock - a.stock
      if (sortBy === 'stock-asc') return a.stock - b.stock
      return 0
    })

    return result
  }, [inventory, searchQuery, filterStock, sortBy])

  // Stats calculation
  const stats = useMemo(() => {
    const totalSKUs = inventory.length
    const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0)
    const lowStockCount = inventory.filter(item => item.stock > 0 && item.stock <= 15).length
    const outOfStockCount = inventory.filter(item => item.stock === 0).length

    return { totalSKUs, totalStock, lowStockCount, outOfStockCount }
  }, [inventory])

  // Adjust stock
  const handleOpenAdjust = (item) => {
    setAdjustItem(item)
    setAdjustValue(item.stock.toString())
    setError('')
  }

  const handleSaveAdjust = async (e) => {
    e.preventDefault()
    const val = parseFloat(adjustValue)
    if (isNaN(val) || val < 0) {
      setError('Please enter a valid stock level >= 0')
      return
    }

    try {
      setUpdating(true)
      setError('')
      await api.put(`/stores/${id}/inventory/${adjustItem.product_id}`, { stock: val })
      
      // Update local state directly
      setInventory(prev => prev.map(item => 
        item.product_id === adjustItem.product_id 
          ? { ...item, stock: val } 
          : item
      ))
      setAdjustItem(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update stock level.')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
        <p className="text-zinc-400 text-sm">Loading inventory registry...</p>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
        <XCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h3 className="text-lg font-bold text-white uppercase">Store not found</h3>
        <button onClick={() => navigate('/store')} className="mt-4 px-4 py-2 bg-zinc-800 text-white rounded-xl text-sm font-semibold">
          Back to Store Registry
        </button>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Back navigation & Header */}
      <div className="space-y-4">
        <button 
          onClick={() => navigate('/store')}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-semibold transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Store Registry
        </button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              {store.is_central ? <Factory size={28} /> : <Building2 size={28} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-black text-white uppercase tracking-tight">{store.name}</h1>
                {store.is_central && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[9px] font-bold uppercase tracking-wider text-amber-400">
                    <Crown size={10} />
                    Central Store (HQ)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 text-sm mt-1">
                <MapPin size={14} className="text-zinc-500" />
                <span>{store.address || `${store.city}, ${store.state}`}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 text-xs font-semibold text-zinc-400 border border-zinc-800 bg-zinc-950 p-3 rounded-xl self-start md:self-auto">
            {store.phone && (
              <div className="flex items-center gap-1.5">
                <Phone size={14} className="text-zinc-500" />
                <span>{store.phone}</span>
              </div>
            )}
            {store.manager_name && (
              <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-4">
                <User size={14} className="text-zinc-500" />
                <span>Manager: {store.manager_name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
          <p className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">Total SKUs</p>
          <p className="text-2xl font-black text-white mt-1">{stats.totalSKUs}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
          <p className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">Total Stock</p>
          <p className="text-2xl font-black text-white mt-1">{stats.totalStock} bags</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 hover:border-amber-500/20 transition-colors">
          <p className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">Low Stock Items</p>
          <p className={`text-2xl font-black mt-1 ${stats.lowStockCount > 0 ? 'text-amber-400' : 'text-white'}`}>
            {stats.lowStockCount}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 hover:border-red-500/20 transition-colors">
          <p className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">Out of Stock Items</p>
          <p className={`text-2xl font-black mt-1 ${stats.outOfStockCount > 0 ? 'text-red-400' : 'text-white'}`}>
            {stats.outOfStockCount}
          </p>
        </div>
      </div>

      {/* Controls: Search, Sort, Filter */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-550" size={18} />
          <input
            type="text"
            placeholder="Search products in store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-750 focus:border-emerald-500 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-zinc-950 p-1 border border-zinc-800 rounded-xl">
            {['all', 'in', 'low', 'out'].map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterStock(mode)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors capitalize
                  ${filterStock === mode 
                    ? 'bg-zinc-800 text-white shadow-md' 
                    : 'text-zinc-400 hover:text-white'}`}
              >
                {mode === 'in' ? 'In Stock' : mode === 'low' ? 'Low Stock' : mode === 'out' ? 'Out of Stock' : 'All'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2">
            <ArrowUpDown size={14} className="text-zinc-550" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent text-xs font-bold text-zinc-300 focus:outline-none cursor-pointer pr-1"
            >
              <option value="name-asc">Product Name: A to Z</option>
              <option value="name-desc">Product Name: Z to A</option>
              <option value="stock-desc">Stock: High to Low</option>
              <option value="stock-asc">Stock: Low to High</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Registry Catalog Grid */}
      {filteredInventory.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
          <Package className="mx-auto text-zinc-650 mb-3" size={48} />
          <h3 className="text-lg font-bold text-white uppercase">No products match</h3>
          <p className="text-zinc-500 text-sm mt-1">Try adjusting filters or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredInventory.map((item) => {
            const isOut = item.stock === 0
            const isLow = item.stock > 0 && item.stock <= 15
            
            return (
              <div 
                key={item.id}
                className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 hover:shadow-2xl transition-all duration-300 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-300" />
                
                <div>
                  {/* Top Row: Icon and stock status badge */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-300 group-hover:scale-105
                      ${isOut 
                        ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                        : isLow 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}
                    >
                      <Package size={22} />
                    </div>

                    {isOut ? (
                      <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-black uppercase rounded-lg tracking-wider">
                        Out of Stock
                      </span>
                    ) : isLow ? (
                      <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase rounded-lg tracking-wider animate-pulse">
                        Low Stock
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase rounded-lg tracking-wider">
                        In Stock
                      </span>
                    )}
                  </div>

                  {/* Product Details */}
                  <h3 className="font-extrabold text-white text-base leading-snug group-hover:text-emerald-400 transition-colors duration-200 line-clamp-2" title={item.product_name}>
                    {item.product_name}
                  </h3>
                  
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-zinc-500">
                    <span>Category:</span>
                    <span className="text-zinc-400">{item.product_category}</span>
                  </div>
                </div>

                {/* Stock Level & Adjust Button */}
                <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider block">In Registry</span>
                    <span className={`text-base font-black
                      ${isOut 
                        ? 'text-red-400' 
                        : isLow 
                          ? 'text-amber-400' 
                          : 'text-white'}`}
                    >
                      {item.stock} {item.default_unit.toLowerCase()}{item.stock !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {hasWriteAccess && (
                    <button
                      onClick={() => handleOpenAdjust(item)}
                      className="p-2 bg-zinc-800 hover:bg-emerald-800 text-zinc-400 hover:text-white rounded-lg transition-all active:scale-[0.93] border border-zinc-700/50 hover:border-emerald-600/50 flex items-center justify-center"
                      title="Adjust Stock"
                    >
                      <Edit3 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Adjust Stock Level Modal */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setAdjustItem(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">Adjust Registry Stock</h2>
                <p className="text-zinc-400 text-xs mt-0.5 font-medium truncate max-w-[280px]">
                  {adjustItem.product_name}
                </p>
              </div>
              <button onClick={() => setAdjustItem(null)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveAdjust} className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-zinc-500 font-bold mb-1.5">
                  Current Stock Level ({adjustItem.default_unit}s)
                </label>
                <input
                  type="number"
                  step="any"
                  value={adjustValue}
                  onChange={(e) => setAdjustValue(e.target.value)}
                  placeholder="0"
                  className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustItem(null)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
                >
                  {updating && <Loader2 className="animate-spin" size={13} />}
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
