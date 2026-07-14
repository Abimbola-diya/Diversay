import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getWithCache, invalidateCache } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import AccessGatewayModal from '../components/AccessGatewayModal'
import { STATE_CENTROIDS } from '../components/NigeriaMap'
import {
  ArrowLeft,
  Search,
  Users,
  Edit3,
  Trash2,
  Plus,
  X,
  Loader2,
  Building2,
  MapPin,
  Phone,
  Mail,
  Building
} from 'lucide-react'

export default function ManageCustomersPage() {
  const navigate = useNavigate()
  const { hasWriteAccess } = useAuth()

  // Customer state
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(50)
  const [deletingIds, setDeletingIds] = useState([])

  // Access Gateway Modal
  const [showAccessGateway, setShowAccessGateway] = useState(false)

  // Add Customer State
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName] = useState('')
  const [addAddress, setAddAddress] = useState('')
  const [addCity, setAddCity] = useState('')
  const [addState, setAddState] = useState('')
  const [addContact, setAddContact] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addError, setAddError] = useState('')
  const [savingCustomer, setSavingCustomer] = useState(false)

  // Edit Customer State
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editName, setEditName] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editState, setEditState] = useState('')
  const [editContact, setEditContact] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const fetchCustomers = async (forceRefresh = false) => {
    try {
      setLoading(true)
      if (forceRefresh) {
        invalidateCache('/customers')
      }
      const response = await getWithCache('/customers', { 
        params: { limit: 1000 },
        onCacheUpdate: (newData) => {
          const items = newData.items || newData || []
          setCustomers(items)
        }
      })
      const items = response.data.items || response.data || []
      setCustomers(items)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch customers:', err)
      setError('Failed to load customers list. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  // Filter customers by search term
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers
    const q = searchQuery.toLowerCase().trim()
    return customers.filter(c => 
      c.name?.toLowerCase().includes(q) ||
      c.state?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q) ||
      c.contact_number?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    )
  }, [customers, searchQuery])

  // Debounce search input to avoid keyboard lag when typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 150) // 150ms delay is ideal for lag-free typing experience
    return () => clearTimeout(handler)
  }, [searchInput])

  // Reset visibleCount when search query changes
  useEffect(() => {
    setVisibleCount(50)
  }, [searchQuery])

  // Infinite scroll intersection observer to dynamically render additional rows
  useEffect(() => {
    if (filteredCustomers.length <= visibleCount) return

    const sentinel = document.getElementById('load-more-sentinel')
    if (!sentinel) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => prev + 50)
      }
    }, {
      rootMargin: '200px' // Load ahead of time for smooth scrolling
    })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [filteredCustomers, visibleCount])

  // Open add modal
  const handleOpenAddModal = () => {
    if (!hasWriteAccess) {
      setShowAccessGateway(true)
      return
    }
    setAddName('')
    setAddAddress('')
    setAddCity('')
    setAddState('')
    setAddContact('')
    setAddEmail('')
    setAddError('')
    setShowAddModal(true)
  }

  // Submit add customer
  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!addName.trim()) {
      setAddError('Customer name is required')
      return
    }
    setSavingCustomer(true)
    setAddError('')
    try {
      const response = await api.post('/customers/', {
        name: addName.trim(),
        address: addAddress.trim() || null,
        city: addCity.trim() || null,
        state: addState.trim() || null,
        contact_number: addContact.trim() || null,
        email: addEmail.trim() || null
      })
      const createdCustomer = response.data
      
      // Snappy updates: immediately append new customer to local state and close modal
      setCustomers(prev => [createdCustomer, ...prev])
      setShowAddModal(false)

      // Invalidate cache and fetch database silently in the background
      invalidateCache('/customers')
      fetchCustomers()
    } catch (err) {
      console.error('Failed to create customer:', err)
      setAddError(err.response?.data?.detail || 'Failed to save customer. Please check input.')
    } finally {
      setSavingCustomer(false)
    }
  }

  // Open edit modal
  const handleOpenEditModal = (customer) => {
    if (!hasWriteAccess) {
      setShowAccessGateway(true)
      return
    }
    setEditingCustomer(customer)
    setEditName(customer.name || '')
    setEditAddress(customer.address || '')
    setEditCity(customer.city || '')
    setEditState(customer.state || '')
    setEditContact(customer.contact_number || '')
    setEditEmail(customer.email || '')
    setEditError('')
    setShowEditModal(true)
  }

  // Submit edit customer
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editName.trim()) {
      setEditError('Customer name is required')
      return
    }
    setSavingEdit(true)
    setEditError('')
    try {
      const response = await api.put(`/customers/${editingCustomer.id}`, {
        name: editName.trim(),
        address: editAddress.trim() || null,
        city: editCity.trim() || null,
        state: editState.trim() || null,
        contact_number: editContact.trim() || null,
        email: editEmail.trim() || null
      })
      const updatedCustomer = response.data
      
      // Snappy updates: immediately modify local state and close modal
      setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...updatedCustomer } : c))
      setShowEditModal(false)

      // Invalidate cache and fetch database silently in the background
      invalidateCache('/customers')
      fetchCustomers()
    } catch (err) {
      console.error('Failed to edit customer:', err)
      setEditError(err.response?.data?.detail || 'Failed to edit customer. Please check input.')
    } finally {
      setSavingEdit(false)
    }
  }

  // Soft delete customer
  const handleDeleteCustomer = async (customer) => {
    if (!hasWriteAccess) {
      setShowAccessGateway(true)
      return
    }
    if (!window.confirm(`Are you sure you want to delete ${customer.name}? This will remove them from active customers.`)) {
      return
    }

    // Add to deletingIds to trigger swipe out animation
    setDeletingIds(prev => [...prev, customer.id])

    try {
      await api.delete(`/customers/${customer.id}`)
      
      // Wait for the swipe-out transition (400ms)
      await new Promise(resolve => setTimeout(resolve, 400))
      
      // Update local state to remove customer
      setCustomers(prev => prev.filter(c => c.id !== customer.id))
      setDeletingIds(prev => prev.filter(id => id !== customer.id))

      // Invalidate cache and fetch database silently in background
      invalidateCache('/customers')
      fetchCustomers()
    } catch (err) {
      // Restore row if API fails
      setDeletingIds(prev => prev.filter(id => id !== customer.id))
      console.error('Failed to delete customer:', err)
      alert(err.response?.data?.detail || 'Failed to delete customer.')
    }
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <style>{`
        .row-swipe-delete {
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease-out;
        }
        .row-swipe-delete.deleting {
          transform: translateX(100%);
          opacity: 0;
        }
        .row-swipe-delete.deleting td {
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          height: 0 !important;
          line-height: 0 !important;
          border-bottom-width: 0 !important;
          transition: padding 0.4s ease-in-out, height 0.4s ease-in-out;
        }
      `}</style>
      {/* Navigation and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/customers')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm font-semibold transition-colors group mb-2"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Customers Map
          </button>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Users className="text-zinc-400 w-8 h-8" />
            Customer Directory
          </h1>
          <p className="text-zinc-400 text-sm">
            View, edit, and manage Diversay logistics customers records
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 hover:border-emerald-500/50 rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.97] self-start sm:self-center"
        >
          <Plus size={14} />
          Create New Customer
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Total Active Registry</p>
          <p className="text-2xl font-black text-white mt-1">{customers.length} Customers</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Search Filtered Match</p>
          <p className="text-2xl font-black text-white mt-1">{filteredCustomers.length} Match</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">System Status</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">Live Database</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 shadow-xl">
        <div className="relative w-full max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Search by name, state, city, contact info or address..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-zinc-950/60 border border-zinc-850 hover:border-zinc-700 focus:border-zinc-600 text-zinc-200 text-sm rounded-xl pl-11 pr-4 py-2.5 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Main List Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
          <Loader2 className="animate-spin text-emerald-500" size={40} />
          <p className="text-zinc-400 text-sm font-medium">Loading customer database...</p>
        </div>
      ) : error ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-red-400">
          <p className="font-semibold">{error}</p>
          <button
            onClick={() => fetchCustomers()}
            className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-white rounded-xl text-xs font-semibold"
          >
            Retry Fetching
          </button>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-550">
          <Users size={48} className="mx-auto text-zinc-650 mb-3" />
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">No Customers Found</h3>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            Try adjusting your search criteria or register a new customer above.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-850 bg-zinc-950/40 text-xs font-semibold text-zinc-450 uppercase tracking-wider">
                  <th className="px-6 py-3 text-left">Customer details</th>
                  <th className="px-6 py-3 text-left">State / Region</th>
                  <th className="px-6 py-3 text-left">Contact line</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {filteredCustomers.slice(0, visibleCount).map((c) => {
                  const isDeleting = deletingIds.includes(c.id)
                  return (
                    <tr 
                      key={c.id} 
                      className={`row-swipe-delete hover:bg-zinc-850/15 transition-all duration-155 ${
                        isDeleting ? 'deleting' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-zinc-400 shrink-0">
                            <Building size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white uppercase tracking-tight">{c.name}</p>
                            {c.address && (
                              <p className="text-xs text-zinc-450 mt-1 flex items-start gap-1 leading-relaxed">
                                <MapPin size={12} className="shrink-0 mt-0.5 text-zinc-600" />
                                <span>{c.address}{c.city ? `, ${c.city}` : ''}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 border border-zinc-750 text-xs font-semibold text-zinc-300 rounded-lg uppercase">
                          <MapPin size={11} className="text-zinc-550" />
                          {c.state || 'Unspecified'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5 text-xs text-zinc-350">
                          {c.contact_number && (
                            <p className="flex items-center gap-1.5 font-mono">
                              <Phone size={12} className="text-zinc-650 shrink-0" />
                              <span>{c.contact_number}</span>
                            </p>
                          )}
                          {c.email && (
                            <p className="flex items-center gap-1.5 font-mono">
                              <Mail size={12} className="text-zinc-650 shrink-0" />
                              <span className="truncate max-w-[180px]">{c.email}</span>
                            </p>
                          )}
                          {!c.contact_number && !c.email && (
                            <span className="text-zinc-600 italic">No contact details</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg border border-transparent hover:border-zinc-700 transition-all duration-200"
                            title="Edit Customer"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(c)}
                            className="p-2 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 rounded-lg border border-transparent hover:border-red-500/25 transition-all duration-200"
                            title="Delete Customer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filteredCustomers.length > visibleCount && (
            <div id="load-more-sentinel" className="flex items-center justify-center gap-2 py-6 bg-zinc-950/20 border-t border-zinc-850 text-zinc-500 text-xs font-semibold">
              <Loader2 size={14} className="animate-spin text-zinc-550" />
              Loading more customers...
            </div>
          )}
        </div>
      )}

      {/* Access Gateway Modal for viewers */}
      <AccessGatewayModal
        isOpen={showAccessGateway}
        onClose={() => setShowAccessGateway(false)}
      />

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/40">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-zinc-400" />
                Add New Customer
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-all">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {addError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-xs font-semibold">
                  ⚠️ {addError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Customer Name *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Acme Logistics Nigeria"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    State
                  </label>
                  <select
                    value={addState}
                    onChange={(e) => setAddState(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm cursor-pointer font-semibold"
                  >
                    <option value="">Select State</option>
                    {Object.entries(STATE_CENTROIDS).map(([key, val]) => (
                      <option key={key} value={val.label}>
                        {val.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    City
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. Ikeja"
                    value={addCity}
                    onChange={(e) => setAddCity(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-655 focus:outline-none focus:border-zinc-700 transition-colors text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Address
                </label>
                <input 
                  type="text"
                  placeholder="e.g. 12 Allen Avenue"
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-655 focus:outline-none focus:border-zinc-700 transition-colors text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Contact Number
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. +234 803..."
                    value={addContact}
                    onChange={(e) => setAddContact(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-655 focus:outline-none focus:border-zinc-700 transition-colors text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Email Address
                  </label>
                  <input 
                    type="email"
                    placeholder="e.g. contact@acme.ng"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-655 focus:outline-none focus:border-zinc-700 transition-colors text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-zinc-800 hover:bg-zinc-800 text-zinc-350 hover:text-white font-semibold rounded-xl transition-all duration-200 text-xs active:scale-[0.97]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 hover:border-emerald-500/50 font-bold rounded-xl transition-all duration-200 text-xs active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingCustomer ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Customer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/40">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Edit3 size={16} className="text-zinc-400" />
                Edit Customer Details
              </h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-all">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-xs font-semibold">
                  ⚠️ {editError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Customer Name *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Acme Logistics Nigeria"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    State
                  </label>
                  <select
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 focus:outline-none focus:border-zinc-700 transition-colors text-sm cursor-pointer font-semibold"
                  >
                    <option value="">Select State</option>
                    {Object.entries(STATE_CENTROIDS).map(([key, val]) => (
                      <option key={key} value={val.label}>
                        {val.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    City
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. Ikeja"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-655 focus:outline-none focus:border-zinc-700 transition-colors text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Address
                </label>
                <input 
                  type="text"
                  placeholder="e.g. 12 Allen Avenue"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-655 focus:outline-none focus:border-zinc-700 transition-colors text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Contact Number
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. +234 803..."
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-655 focus:outline-none focus:border-zinc-700 transition-colors text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Email Address
                  </label>
                  <input 
                    type="email"
                    placeholder="e.g. contact@acme.ng"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-950/60 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-655 focus:outline-none focus:border-zinc-700 transition-colors text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-zinc-800 hover:bg-zinc-800 text-zinc-350 hover:text-white font-semibold rounded-xl transition-all duration-200 text-xs active:scale-[0.97]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 hover:border-emerald-500/50 font-bold rounded-xl transition-all duration-200 text-xs active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
