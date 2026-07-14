import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api, { getWithCache, isCached, invalidateCache } from '../services/api'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts'
import { TrendingUp, BarChart3, PieChart as PieIcon, ArrowRightLeft } from 'lucide-react'
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  User, 
  Search, 
  ArrowUpDown, 
  ChevronDown,
  Grid,
  List,
  Package, 
  Crown, 
  Factory, 
  Building2, 
  Edit3, 
  X,
  Plus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2
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
  const [filterBrand, setFilterBrand] = useState('all')
  const [sortBy, setSortBy] = useState('name-asc')
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [viewMode, setViewMode] = useState('grid')
  
  const [adjustItem, setAdjustItem] = useState(null)
  const [adjustValue, setAdjustValue] = useState('')
  const [adjustReorderLevel, setAdjustReorderLevel] = useState('')
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')

  // Add Product State
  const [showAddModal, setShowAddModal] = useState(false)
  const [addMode, setAddMode] = useState('existing') // 'existing' | 'new'
  const [globalProducts, setGlobalProducts] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [newProdName, setNewProdName] = useState('')
  const [newProdCategory, setNewProdCategory] = useState('Other')
  const [newProdUnit, setNewProdUnit] = useState('Carton')
  const [initialStock, setInitialStock] = useState('0')
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')

  const hasWriteAccess = user?.role === 'admin' || user?.has_write_access === true

  // Tab state: default to 'analytics'
  const [activeTab, setActiveTab] = useState('analytics')
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  useEffect(() => {
    fetchStoreAndInventory()
    fetchAnalytics()
  }, [id])

  const fetchAnalytics = async () => {
    try {
      const cacheKey = `/stores/${id}/analytics`
      const hasCached = isCached(cacheKey)
      if (!hasCached && !analytics) {
        setAnalyticsLoading(true)
      }
      const res = await getWithCache(cacheKey, {
        onCacheUpdate: (newData) => setAnalytics(newData)
      })
      setAnalytics(res.data)
    } catch (err) {
      console.error('Failed to load store analytics:', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const fetchStoreAndInventory = async () => {
    try {
      const isCurrentlyLoading = !store || inventory.length === 0
      if (isCurrentlyLoading) setLoading(true)
      
      const [storeRes, invRes] = await Promise.all([
        getWithCache(`/stores/${id}`, {
          onCacheUpdate: (newData) => setStore(newData)
        }),
        getWithCache(`/stores/${id}/inventory`, {
          onCacheUpdate: (newData) => setInventory(newData || [])
        })
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
      result = result.filter(item => item.stock > (item.reorder_level ?? 15.0))
    } else if (filterStock === 'low') {
      result = result.filter(item => item.stock > 0 && item.stock <= (item.reorder_level ?? 15.0))
    } else if (filterStock === 'out') {
      result = result.filter(item => item.stock === 0)
    }

    // Brand filter
    if (filterBrand === 'dsl') {
      result = result.filter(item => item.product_brand?.toUpperCase() === 'DSL')
    } else if (filterBrand === 'dslp') {
      result = result.filter(item => item.product_brand?.toUpperCase() === 'DSLP')
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
  }, [inventory, searchQuery, filterStock, filterBrand, sortBy])

  // Stats calculation
  const stats = useMemo(() => {
    const totalSKUs = inventory.length
    const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0)
    const lowStockCount = inventory.filter(item => item.stock > 0 && item.stock <= (item.reorder_level ?? 15.0)).length
    const outOfStockCount = inventory.filter(item => item.stock === 0).length

    return { totalSKUs, totalStock, lowStockCount, outOfStockCount }
  }, [inventory])

  // Adjust stock
  const handleOpenAdjust = (item) => {
    setAdjustItem(item)
    setAdjustValue(item.stock.toString())
    setAdjustReorderLevel((item.reorder_level ?? 15.0).toString())
    setError('')
  }

  const handleSaveAdjust = async (e) => {
    e.preventDefault()
    const val = parseFloat(adjustValue)
    const reorderVal = parseFloat(adjustReorderLevel)
    if (isNaN(val) || val < 0) {
      setError('Please enter a valid stock level >= 0')
      return
    }
    if (isNaN(reorderVal) || reorderVal < 0) {
      setError('Please enter a valid reorder level >= 0')
      return
    }

    try {
      setUpdating(true)
      setError('')
      await api.put(`/stores/${id}/inventory/${adjustItem.product_id}`, { 
        stock: val,
        reorder_level: reorderVal
      })
      invalidateCache(`/stores/${id}/inventory`)
      invalidateCache(`/stores/${id}/analytics`)
      fetchAnalytics()
      
      // Update local state directly
      setInventory(prev => prev.map(item => 
        item.product_id === adjustItem.product_id 
          ? { ...item, stock: val, reorder_level: reorderVal } 
          : item
      ))
      setAdjustItem(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update stock level.')
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete ${product.product_name} from this store's inventory registry?`)) {
      return
    }

    try {
      setUpdating(true)
      await api.delete(`/stores/${id}/inventory/${product.product_id}`)
      invalidateCache(`/stores/${id}/inventory`)
      invalidateCache(`/stores/${id}/analytics`)
      fetchAnalytics()
      
      // Update local state directly
      setInventory(prev => prev.filter(item => item.product_id !== product.product_id))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete product from store.')
    } finally {
      setUpdating(false)
    }
  }

  const handleOpenAddModal = async () => {
    setShowAddModal(true)
    setAddMode('existing')
    setSelectedProductId('')
    setNewProdName('')
    setNewProdCategory('Other')
    setNewProdUnit('Carton')
    setInitialStock('0')
    setModalError('')
    
    try {
      setModalLoading(true)
      const res = await getWithCache('/products', { params: { limit: 1000 } })
      const existingIds = new Set(inventory.map(item => item.product_id))
      const allProducts = res.data.items || res.data || []
      const available = allProducts.filter(p => !existingIds.has(p.id))
      setGlobalProducts(available)
    } catch (err) {
      setModalError('Failed to load global products list.')
    } finally {
      setModalLoading(false)
    }
  }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    setModalError('')
    
    const stockVal = parseFloat(initialStock)
    if (isNaN(stockVal) || stockVal < 0) {
      setModalError('Initial stock must be >= 0')
      return
    }

    setUpdating(true)
    try {
      let productId = selectedProductId
      let productName = ''
      let productCategory = ''
      let productUnit = ''
      
      if (addMode === 'new') {
        if (!newProdName.trim()) {
          setModalError('Product name is required')
          setUpdating(false)
          return
        }
        const prodRes = await api.post('/products', {
          name: newProdName.trim(),
          category: newProdCategory,
          default_unit: newProdUnit
        })
        productId = prodRes.data.id
        productName = prodRes.data.name
        productCategory = prodRes.data.category
        productUnit = prodRes.data.default_unit
      } else {
        if (!productId) {
          setModalError('Please select a product')
          setUpdating(false)
          return
        }
        const selected = globalProducts.find(p => p.id === parseInt(productId))
        productName = selected.name
        productCategory = selected.category
        productUnit = selected.default_unit
      }

      const invRes = await api.put(`/stores/${id}/inventory/${productId}`, {
        stock: stockVal
      })
      invalidateCache(`/stores/${id}/inventory`)
      invalidateCache(`/stores/${id}/analytics`)
      fetchAnalytics()

      setInventory(prev => [
        ...prev,
        {
          id: invRes.data.id,
          store_id: parseInt(id),
          product_id: parseInt(productId),
          product_name: productName,
          product_category: productCategory,
          default_unit: productUnit,
          stock: stockVal,
          unit_price: 0.0
        }
      ])
      
      setShowAddModal(false)
    } catch (err) {
      setModalError(err.response?.data?.detail || 'Failed to add product to store.')
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
        <div className="flex items-center justify-between gap-4">
          <button 
            onClick={() => navigate('/store')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-semibold transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Store Registry
          </button>

          {hasWriteAccess && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.97]"
            >
              <Plus size={14} />
              Add Product to Store
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              {store.is_central ? <Factory size={28} /> : <Building2 size={28} />}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-white uppercase tracking-tight">{store.name}</h1>
                {store.is_central && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[9px] font-bold uppercase tracking-wider text-amber-400">
                    <Crown size={10} />
                    Central Store (HQ)
                  </span>
                )}
                {store.phone && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl">
                    <Phone size={13} className="text-zinc-500" />
                    <span>{store.phone}</span>
                  </div>
                )}
                {store.manager_name && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl">
                    <User size={13} className="text-zinc-500" />
                    <span>Manager: {store.manager_name}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400 text-sm mt-2">
                <MapPin size={14} className="text-zinc-500" />
                <span>{store.address || `${store.city}, ${store.state}`}</span>
              </div>
            </div>
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

      {/* Switcher tabs */}
      <div className="flex border-b border-zinc-800 gap-2">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-xs uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'analytics'
              ? 'border-emerald-500 text-white font-bold bg-emerald-500/5'
              : 'border-transparent text-zinc-550 hover:text-zinc-300'
          }`}
        >
          <BarChart3 size={14} /> Store Analytics
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-5 py-3 font-semibold text-xs uppercase tracking-wider transition-all border-b-2 ${
            activeTab === 'inventory'
              ? 'border-emerald-500 text-white font-bold bg-emerald-500/5'
              : 'border-transparent text-zinc-550 hover:text-zinc-300'
          }`}
        >
          <Package size={14} /> See Inventory
        </button>
      </div>

      {activeTab === 'analytics' ? (
        analyticsLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4 bg-zinc-950/20 border border-zinc-900 rounded-2xl animate-in fade-in duration-200">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
            <p className="text-zinc-550 text-xs font-semibold">Loading store analytics...</p>
          </div>
        ) : !analytics ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center animate-in fade-in duration-200">
            <TrendingUp className="mx-auto text-zinc-650 mb-3" size={48} />
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">No Analytics Data</h3>
            <p className="text-zinc-500 text-xs mt-1 font-medium">This store doesn't have any logged transactions or transfers yet.</p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Analytics Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Total Inbound Transfers</p>
                    <p className="text-2xl font-black text-white mt-1">{analytics.total_incoming}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <ArrowRightLeft size={14} />
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">Total Outbound Transfers</p>
                    <p className="text-2xl font-black text-white mt-1">{analytics.total_outgoing}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <ArrowRightLeft size={14} className="rotate-180" />
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">DSL Brand Stock</p>
                    <p className="text-2xl font-black text-sky-400 mt-1">{analytics.dsl_stock} units</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 text-[10px] font-black">
                    DSL
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-550 font-bold">DSLP Brand Stock</p>
                    <p className="text-2xl font-black text-purple-400 mt-1">{analytics.dslp_stock} units</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-[9px] font-black">
                    DSLP
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Trending Products Bar Chart */}
              <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 shadow-xl flex flex-col min-h-[350px]">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 size={16} className="text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Top 5 Trending Products</h3>
                </div>
                <div className="flex-1 w-full h-[250px]">
                  {analytics.top_products && analytics.top_products.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.top_products} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#71717a" fontSize={9} tickLine={false} />
                        <YAxis stroke="#71717a" fontSize={9} tickLine={false} />
                        <Tooltip
                          cursor={false}
                          contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                          labelStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                          itemStyle={{ color: '#ffffff', fontSize: '11px' }}
                        />
                        <Bar 
                          dataKey="quantity" 
                          fill="#ffffff" 
                          activeBar={{ fill: '#d4d4d8' }}
                          radius={[4, 4, 0, 0]} 
                          barSize={32} 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-550 text-xs font-medium">
                      No transaction history to compute trends.
                    </div>
                  )}
                </div>
              </div>

              {/* DSL vs DSLP Brand Mix Pie Chart */}
              <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 shadow-xl flex flex-col min-h-[350px]">
                <div className="flex items-center gap-2 mb-6">
                  <PieIcon size={16} className="text-sky-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Inventory Brand Share (DSL vs DSLP)</h3>
                </div>
                <div className="flex-1 w-full h-[250px] flex flex-col sm:flex-row items-center justify-center gap-6">
                  {analytics.dsl_count > 0 || analytics.dslp_count > 0 ? (
                    <>
                      <div className="w-full sm:w-1/2 h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'DSL Products', value: analytics.dsl_count },
                                { name: 'DSLP Products', value: analytics.dslp_count }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              <Cell fill="#0ea5e9" />
                              <Cell fill="#a855f7" />
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                              itemStyle={{ fontSize: '11px' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-3 text-xs font-semibold w-full sm:w-1/2">
                        <div className="flex items-center gap-3 p-3 bg-sky-950/10 border border-sky-900/30 rounded-xl">
                          <div className="w-3 h-3 rounded-full bg-sky-500 shrink-0" />
                          <div className="flex-1">
                            <span className="text-zinc-400 block text-[9px] uppercase tracking-wider font-bold">DSL Brand</span>
                            <span className="text-white text-xs">{analytics.dsl_count} catalog items ({analytics.dsl_stock} stock)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-purple-950/10 border border-purple-900/30 rounded-xl">
                          <div className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
                          <div className="flex-1">
                            <span className="text-zinc-400 block text-[9px] uppercase tracking-wider font-bold">DSLP Brand</span>
                            <span className="text-white text-xs">{analytics.dslp_count} catalog items ({analytics.dslp_stock} stock)</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-550 text-xs font-medium">
                      No inventory items categorized.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Movement Flow Area Chart */}
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-6 shadow-xl flex flex-col min-h-[350px]">
              <div className="flex items-center gap-2 mb-6">
                <ArrowRightLeft size={16} className="text-purple-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Stock Movement Flow (Last 7 Days)</h3>
              </div>
              <div className="flex-1 w-full h-[250px]">
                {analytics.movement_data && analytics.movement_data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.movement_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#18181b" strokeDasharray="3 3" />
                      <XAxis dataKey="date" stroke="#71717a" fontSize={9} tickLine={false} />
                      <YAxis stroke="#71717a" fontSize={9} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                        itemStyle={{ fontSize: '11px' }}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                      <Area name="Incoming Units (Received)" type="monotone" dataKey="incoming" stroke="#10b981" fillOpacity={1} fill="url(#colorIncoming)" strokeWidth={2} />
                      <Area name="Outgoing Units (Dispatched)" type="monotone" dataKey="outgoing" stroke="#ef4444" fillOpacity={1} fill="url(#colorOutgoing)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-550 text-xs font-medium">
                    No movements logged in the last 7 days.
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        <>
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

          <div className="flex bg-zinc-950 p-1 border border-zinc-800 rounded-xl">
            {['all', 'dsl', 'dslp'].map((brandOption) => (
              <button
                key={brandOption}
                onClick={() => setFilterBrand(brandOption)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors uppercase
                  ${filterBrand === brandOption 
                    ? 'bg-zinc-800 text-white shadow-md' 
                    : 'text-zinc-400 hover:text-white'}`}
              >
                {brandOption === 'all' ? 'All Brands' : brandOption}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-750 text-xs font-bold text-zinc-300 rounded-xl px-3.5 py-2.5 transition-all duration-200 active:scale-[0.97]"
            >
              <ArrowUpDown size={14} className="text-zinc-500" />
              <span>{
                sortBy === 'name-asc' ? 'Product Name: A to Z' :
                sortBy === 'name-desc' ? 'Product Name: Z to A' :
                sortBy === 'stock-desc' ? 'Stock: High to Low' :
                'Stock: Low to High'
              }</span>
              <ChevronDown size={14} className={`text-zinc-550 transition-transform duration-250 ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsSortOpen(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-zinc-950 border border-zinc-800 rounded-xl py-1.5 shadow-2xl z-20 animate-in fade-in slide-in-from-top-2 duration-150">
                  {[
                    { value: 'name-asc', label: 'Product Name: A to Z' },
                    { value: 'name-desc', label: 'Product Name: Z to A' },
                    { value: 'stock-desc', label: 'Stock: High to Low' },
                    { value: 'stock-asc', label: 'Stock: Low to High' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSortBy(option.value)
                        setIsSortOpen(false)
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors
                        ${sortBy === option.value 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Grid / List View Toggle */}
          <div className="flex bg-zinc-950 p-1 border border-zinc-800 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500 hover:text-white'}`}
              title="Grid View"
            >
              <Grid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500 hover:text-white'}`}
              title="List View"
            >
              <List size={15} />
            </button>
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
      ) : viewMode === 'list' ? (
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl animate-in fade-in duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-950/50 text-[10px] uppercase tracking-wider text-zinc-550 font-bold">
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-right">Stock Level</th>
                  <th className="px-6 py-4 text-right">Reorder Level</th>
                  <th className="px-6 py-4">Status</th>
                  {hasWriteAccess && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-sm">
                {filteredInventory.map((item) => {
                  const isOut = item.stock === 0
                  const isLow = item.stock > 0 && item.stock <= (item.reorder_level ?? 15.0)
                  
                  return (
                    <tr 
                      key={item.id} 
                      className="hover:bg-zinc-800/20 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center border
                            ${isOut 
                              ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                              : isLow 
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}
                          >
                            <Package size={16} />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-extrabold text-white group-hover:text-emerald-400 transition-colors">
                              {item.product_name}
                            </span>
                            {item.product_brand && (
                              <div>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider uppercase border
                                  ${item.product_brand === 'DSLP' 
                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                    : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}
                                >
                                  {item.product_brand}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                          {item.product_category || 'Other'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-black text-sm ${isOut ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-zinc-100'}`}>
                          {item.stock}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-bold ml-1 uppercase">
                          {item.default_unit.toLowerCase()}{item.stock !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-400 font-bold text-sm">
                        <span>{item.reorder_level ?? 15.0}</span>
                        <span className="text-[10px] text-zinc-500 font-bold ml-1 uppercase">
                          {item.default_unit.toLowerCase()}{(item.reorder_level ?? 15.0) !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-black uppercase rounded-lg tracking-wider">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase rounded-lg tracking-wider">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase rounded-lg tracking-wider">
                            In Stock
                          </span>
                        )}
                      </td>
                      {hasWriteAccess && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <button
                              onClick={() => handleOpenAdjust(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-750 text-zinc-355 hover:text-white rounded-lg text-xs font-bold transition-all active:scale-[0.96]"
                            >
                              <Edit3 size={12} />
                              Adjust Stock
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-950/20 hover:bg-red-900 border border-red-500/25 hover:border-red-650 text-red-400 hover:text-white rounded-lg text-xs font-bold transition-all active:scale-[0.96]"
                              title="Delete Product from Store"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredInventory.map((item) => {
            const isOut = item.stock === 0
            const isLow = item.stock > 0 && item.stock <= (item.reorder_level ?? 15.0)
            
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
                  
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                      {item.product_category || 'Other'}
                    </span>
                    {item.product_brand && (
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wider uppercase border
                        ${item.product_brand === 'DSLP' 
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                          : 'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}
                      >
                        {item.product_brand}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock Level & Adjust Button */}
                <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider block">In Registry</span>
                    <span className={`text-base font-black block
                      ${isOut 
                        ? 'text-red-400' 
                        : isLow 
                          ? 'text-amber-400' 
                          : 'text-white'}`}
                    >
                      {item.stock} {item.default_unit.toLowerCase()}{item.stock !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-medium block mt-0.5">
                      Reorder: {item.reorder_level ?? 15.0} {item.default_unit.toLowerCase()}(s)
                    </span>
                  </div>

                  {hasWriteAccess && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenAdjust(item)}
                        className="p-2 bg-zinc-800 hover:bg-emerald-800 text-zinc-400 hover:text-white rounded-lg transition-all active:scale-[0.93] border border-zinc-700/50 hover:border-emerald-600/50 flex items-center justify-center"
                        title="Adjust Stock"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(item)}
                        className="p-2 bg-zinc-800 hover:bg-red-900 text-zinc-400 hover:text-white rounded-lg transition-all active:scale-[0.93] border border-zinc-700/50 hover:border-red-600/55 flex items-center justify-center"
                        title="Delete Product from Store"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
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
                <label className="block text-[11px] uppercase tracking-wider text-zinc-550 font-bold mb-1.5">
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

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-zinc-550 font-bold mb-1.5">
                  Reorder Level Threshold ({adjustItem.default_unit}s)
                </label>
                <input
                  type="number"
                  step="any"
                  value={adjustReorderLevel}
                  onChange={(e) => setAdjustReorderLevel(e.target.value)}
                  placeholder="15"
                  className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none"
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

      {/* Add Product to Registry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowAddModal(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">Add Product to Registry</h2>
                <p className="text-zinc-400 text-xs mt-0.5 font-medium truncate max-w-[280px]">
                  Register or create a product for this store.
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Modal Error */}
            {modalError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-semibold">
                {modalError}
              </div>
            )}

            {/* Modal Tabs */}
            <div className="flex border-b border-zinc-800 mb-4">
              <button
                type="button"
                onClick={() => setAddMode('existing')}
                className={`flex-1 pb-2.5 text-xs font-bold transition-colors
                  ${addMode === 'existing' 
                    ? 'border-b-2 border-emerald-500 text-white' 
                    : 'text-zinc-400 hover:text-white'}`}
              >
                Select Existing Product
              </button>
              <button
                type="button"
                onClick={() => setAddMode('new')}
                className={`flex-1 pb-2.5 text-xs font-bold transition-colors
                  ${addMode === 'new' 
                    ? 'border-b-2 border-emerald-500 text-white' 
                    : 'text-zinc-400 hover:text-white'}`}
              >
                Create New Product
              </button>
            </div>

            {modalLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-2">
                <Loader2 className="animate-spin text-emerald-500" size={24} />
                <p className="text-zinc-500 text-xs font-semibold">Loading catalog items...</p>
              </div>
            ) : (
              <form onSubmit={handleAddProduct} className="space-y-4">
                {addMode === 'existing' ? (
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-zinc-550 font-bold mb-1.5">
                      Select Product
                    </label>
                    {globalProducts.length === 0 ? (
                      <div className="text-zinc-500 text-xs p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                        No additional products available in global catalog to add. Create a new one!
                      </div>
                    ) : (
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus:outline-none cursor-pointer"
                      >
                        <option value="">-- Choose Product --</option>
                        {globalProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.default_unit})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-zinc-550 font-bold mb-1.5">
                        Product Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Enrol 1L"
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] uppercase tracking-wider text-zinc-550 font-bold mb-1.5">
                          Category
                        </label>
                        <select
                          value={newProdCategory}
                          onChange={(e) => setNewProdCategory(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-xs font-bold transition-colors focus:outline-none cursor-pointer"
                        >
                          <option value="Poultry">Poultry</option>
                          <option value="Equine">Equine</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] uppercase tracking-wider text-zinc-550 font-bold mb-1.5">
                          Default Unit
                        </label>
                        <select
                          value={newProdUnit}
                          onChange={(e) => setNewProdUnit(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 text-white rounded-xl px-3 py-2.5 text-xs font-bold transition-colors focus:outline-none cursor-pointer"
                        >
                          <option value="Carton">Carton</option>
                          <option value="Keg">Keg</option>
                          <option value="Bag">Bag</option>
                          <option value="Sachet">Sachet</option>
                          <option value="Pcs">Pcs</option>
                          <option value="Drum">Drum</option>
                          <option value="Bottle">Bottle</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-zinc-550 font-bold mb-1.5">
                    Initial Stock Level
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-emerald-500 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-bold rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating || (addMode === 'existing' && globalProducts.length === 0)}
                    className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
                  >
                    {updating && <Loader2 className="animate-spin" size={13} />}
                    Confirm Add
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
