import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getWithCache, isCached } from '../services/api'
import { STATE_CENTROIDS, NIGERIA_MAP_PATHS } from '../components/NigeriaMap'
import { 
  Search, 
  Users, 
  MapPin, 
  Building, 
  Phone, 
  Mail, 
  Map, 
  Globe, 
  TrendingUp, 
  ChevronRight,
  Info
} from 'lucide-react'

// Normalize state names from DB to match SVG path IDs
const normalizeStateName = (stateName) => {
  if (!stateName) return ""
  let name = stateName.trim().toUpperCase()
  if (name.endsWith(" STATE")) {
    name = name.substring(0, name.length - 6).trim()
  }
  if (name === "AKWA IBOM") return "akwa-ibom"
  if (name === "CROSS RIVER") return "cross-river"
  if (name === "NASARAWA" || name === "NASSARAWA") return "nassarawa"
  if (name === "FEDERAL CAPITAL TERRITORY" || name === "FEDERAL CAPITAL TERRITORY (FCT)" || name === "FCT") return "fct"
  return name.toLowerCase().replace(/\s+/g, '-')
}

const DirectoryList = React.memo(({ filteredCustomers, selectedCustomer, onCustomerClick, onViewProfile }) => {
  const selectedRef = useRef(null)

  useEffect(() => {
    if (selectedCustomer && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedCustomer])

  return (
    <>
      {filteredCustomers.map((c) => {
        const isSelected = selectedCustomer?.id === c.id
        return (
          <div
            key={c.id}
            ref={isSelected ? selectedRef : null}
            onClick={() => onCustomerClick(c)}
            className={`p-3 rounded-xl border text-left cursor-pointer transition-colors duration-150 ease-out ${
              isSelected
                ? 'bg-zinc-900 border-zinc-700 shadow-md shadow-black/40'
                : 'bg-zinc-950 hover:bg-zinc-900/40 border-zinc-900 hover:border-zinc-850'
            }`}
          >
            <div className="flex justify-between items-start gap-2">
              <h4 className="font-bold text-sm text-zinc-100 group-hover:text-white truncate">
                {c.name}
              </h4>
              <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded-md flex-shrink-0">
                {c.state || 'UNKNOWN'}
              </span>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-start gap-1.5 text-xs text-zinc-400">
                <Building size={12} className="text-zinc-600 mt-0.5 flex-shrink-0" />
                <span className="truncate">{c.city ? `${c.city}, ` : ''}{c.address}</span>
              </div>
              {c.contact_number && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Phone size={12} className="text-zinc-600 flex-shrink-0" />
                  <span>{c.contact_number}</span>
                </div>
              )}
              {c.email && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <Mail size={12} className="text-zinc-600 flex-shrink-0" />
                  <span className="truncate">{c.email}</span>
                </div>
              )}
            </div>

            {isSelected && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onViewProfile(c.id)
                }}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded-lg transition-colors shadow-lg"
              >
                <span>View Analytics & Orders</span>
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        )
      })}
    </>
  )
})

// Module-level state — survives component unmount/remount during route navigation
let _cachedCustomers = null

export default function CustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState(() => _cachedCustomers ?? [])
  const [loading, setLoading] = useState(() => !_cachedCustomers)
  const [error, setError] = useState(null)
  
  // Search query & interaction states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [hoveredState, setHoveredState] = useState(null)

  // Debounce search input to avoid keyboard lag when typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 150) // 150ms delay is ideal for lag-free typing experience
    return () => clearTimeout(handler)
  }, [searchInput])
  const [selectedState, setSelectedState] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [visibleCount, setVisibleCount] = useState(100)

  // Reset visibleCount when search query changes
  useEffect(() => {
    setVisibleCount(100)
  }, [searchQuery])


  // Ref for popup list scroll container and selected item
  const popupSelectedRef = useRef(null)

  useEffect(() => {
    if (selectedCustomer && popupSelectedRef.current) {
      popupSelectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedCustomer, selectedState])

  // Ref to handle mouse leave correctly on the popup
  const popupRef = useRef(null)

  // Handle click outside of state path, state pins, popup card, and directory panel to deselect state
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedPopup = popupRef.current && popupRef.current.contains(event.target)
      const clickedStatePath = event.target.closest('path')
      const clickedPin = event.target.closest('circle')
      const clickedRightPanel = event.target.closest('#directory-panel-right')
      
      if (!clickedPopup && !clickedStatePath && !clickedPin && !clickedRightPanel) {
        setSelectedState(null)
        setSelectedCustomer(null)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Fetch customers on mount with instant re-mount from module cache
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        if (!_cachedCustomers) {
          setLoading(true)
        }
        const response = await api.get('/customers?limit=1000')
        const items = response.data.items || []
        setCustomers(items)
        setError(null)
        _cachedCustomers = items
      } catch (err) {
        console.error('Failed to fetch customers:', err)
        if (!_cachedCustomers) {
          setError('Failed to load customers directory. Please try again.')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchCustomers()
  }, [])

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers
    const query = searchQuery.toLowerCase().trim()
    
    // Strict State name search matching (so e.g. searching "lagos" restricts results only to Lagos state, avoiding matches on street addresses containing "lagos")
    const stateKeys = Object.keys(STATE_CENTROIDS)
    const matchingStateKey = stateKeys.find(key => {
      const label = STATE_CENTROIDS[key].label.toLowerCase()
      if (key === query || label === query) return true
      if (key === 'fct' && query === 'abuja') return true
      return false
    })
    
    if (matchingStateKey) {
      return customers.filter(c => normalizeStateName(c.state) === matchingStateKey)
    }

    return customers.filter(c => 
      (c.name && c.name.toLowerCase().includes(query)) ||
      (c.city && c.city.toLowerCase().includes(query)) ||
      (c.state && c.state.toLowerCase().includes(query)) ||
      (c.address && c.address.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query))
    )
  }, [customers, searchQuery])

  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    // If we are within 40px of the bottom, load 20 more
    if (scrollHeight - scrollTop - clientHeight < 40) {
      setVisibleCount(prev => Math.min(prev + 20, filteredCustomers.length))
    }
  }, [filteredCustomers.length])

  // If a customer is selected and is beyond current visible count, expand visible count to render them
  useEffect(() => {
    if (selectedCustomer) {
      const idx = filteredCustomers.findIndex(c => c.id === selectedCustomer.id)
      if (idx !== -1 && idx >= visibleCount) {
        setVisibleCount(prev => Math.max(prev, idx + 20))
      }
    }
  }, [selectedCustomer, filteredCustomers, visibleCount])

  // Group customers by normalized state key
  const customersByState = useMemo(() => {
    const grouped = {}
    filteredCustomers.forEach(customer => {
      const normalized = normalizeStateName(customer.state)
      if (!normalized) return
      if (!grouped[normalized]) {
        grouped[normalized] = []
      }
      grouped[normalized].push(customer)
    })
    return grouped
  }, [filteredCustomers])

  // Total customer counts per state regardless of search query (for original mapping context)
  const unfilteredCountsByState = useMemo(() => {
    const counts = {}
    customers.forEach(customer => {
      const normalized = normalizeStateName(customer.state)
      if (!normalized) return
      counts[normalized] = (counts[normalized] || 0) + 1
    })
    return counts
  }, [customers])

  // General customer stats
  const stats = useMemo(() => {
    const activeStatesSet = new Set()
    customers.forEach(c => {
      const norm = normalizeStateName(c.state)
      if (norm && STATE_CENTROIDS[norm]) {
        activeStatesSet.add(norm)
      }
    })

    // Get top hubs
    const stateCounts = {}
    customers.forEach(c => {
      const norm = normalizeStateName(c.state)
      if (norm && STATE_CENTROIDS[norm]) {
        stateCounts[norm] = (stateCounts[norm] || 0) + 1
      }
    })

    const sortedHubs = Object.entries(stateCounts)
      .map(([id, count]) => ({
        id,
        count,
        label: STATE_CENTROIDS[id]?.label || id.toUpperCase()
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      total: customers.length,
      activeStates: activeStatesSet.size,
      topHubs: sortedHubs
    }
  }, [customers])

  // Handle clicking a customer in the list to highlight their state
  const handleCustomerClick = useCallback((customer) => {
    setSelectedCustomer(customer)
    const normState = normalizeStateName(customer.state)
    if (normState && STATE_CENTROIDS[normState]) {
      setSelectedState(normState)
      setHoveredState(normState)
    }
  }, [])

  // Get active hovered / selected state data for callout card (selected state takes precedence to lock the card position during interaction)
  const activeCalloutState = selectedState || hoveredState
  const activeCalloutCentroid = activeCalloutState ? STATE_CENTROIDS[activeCalloutState] : null
  const activeCalloutCustomers = activeCalloutState ? (customersByState[activeCalloutState] || []) : []

  // Check if search matched any state but we have 0 customers in state from current query
  const displayCallout = activeCalloutCentroid && activeCalloutCustomers.length > 0

  return (
    <div className="text-zinc-100 animate-in fade-in duration-300 pb-12">
      {/* Custom Styles for styling the premium scrollbars and animations */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(24, 24, 27, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(63, 63, 70, 0.8);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(82, 82, 91, 1);
        }
        @keyframes scaleIn {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Globe className="text-zinc-400 w-8 h-8 animate-pulse" />
            Customers Map
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Visual distribution of Diversay logistics customers across Nigeria
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-zinc-700/50 border-t-white animate-spin"></div>
          </div>
          <p className="text-zinc-400 mt-4 text-sm font-medium">Loading customer database & map elements...</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center">
          <Info className="text-red-400 w-12 h-12 mb-4" />
          <p className="text-red-200 font-semibold">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-white rounded-xl text-sm font-medium transition-all"
          >
            Retry Loading
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* LEFT PANEL: Interactive Nigeria SVG Map */}
          <div className="lg:col-span-8 bg-zinc-950 border border-zinc-900 rounded-2xl p-6 relative shadow-inner flex flex-col justify-between h-full min-h-[600px] lg:min-h-0">
            
            {/* Reset View Button when a state is selected */}
            {(selectedState || searchQuery || searchInput) && (
              <button
                onClick={() => {
                  setSelectedState(null)
                  setSearchInput('')
                  setSearchQuery('')
                  setSelectedCustomer(null)
                }}
                className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white rounded-lg backdrop-blur-sm transition-all"
              >
                Clear Filters
              </button>
            )}

            {/* Map Rendering Container */}
            <div className="w-full flex-1 flex items-center justify-center relative p-2 md:p-4 select-none">
              <div className="relative w-full max-w-[650px] aspect-[744/600]">
                
                <svg
                  viewBox="0 0 744 600"
                  className="w-full h-full drop-shadow-[0_10px_30px_rgba(0,0,0,0.9)]"
                  style={{ transform: 'translate3d(0,0,0)' }}
                >
                  <defs>
                    {/* Glowing Red linear split 3D gradient for realistic location pin */}
                    <linearGradient id="location-pin-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="45%" stopColor="#dc2626" />
                      <stop offset="55%" stopColor="#b91c1c" />
                      <stop offset="100%" stopColor="#7f1d1d" />
                    </linearGradient>
                  </defs>

                  <g id="nigeria-states">
                    {NIGERIA_MAP_PATHS.map((state) => {
                      const count = unfilteredCountsByState[state.id] || 0
                      const hasMatchingCustomers = (customersByState[state.id] || []).length > 0
                      const isHovered = hoveredState === state.id
                      const isSelected = selectedState === state.id
                      
                      // Density distribution color mapping (shades of Obsidian, Teal Graphite, Indigo Charcoal, and Pewter)
                      let fill = "#0c0d12" // CORE (Obsidian)
                      if (count > 0) {
                        if (count <= 2) fill = "#1f2b2d"      // MODERATE (Teal Graphite)
                        else if (count <= 5) fill = "#394451" // HIGH (Indigo Charcoal)
                        else fill = "#cbd2db"                 // PEAK (Pewter)
                      }
                      
                      let stroke = "#8e9aa8" // Thin cool silver-grey borders from reference image
                      let strokeWidth = "1.2"
                      let opacity = "1"
                      
                      // Active search query overrides
                      if (searchQuery) {
                        if (hasMatchingCustomers) {
                          stroke = "#8e9aa8"
                          strokeWidth = "1.2"
                        } else {
                          opacity = "0.2"
                          stroke = "#27272a"
                          strokeWidth = "0.8"
                        }
                      }

                      return (
                        <path
                          key={state.id}
                          id={state.id}
                          d={state.d}
                          style={{ fill, stroke, strokeWidth, opacity }}
                          className="transition-all duration-75 ease-out cursor-pointer"
                          onMouseEnter={() => {
                            setHoveredState(state.id)
                          }}
                          onMouseLeave={() => {
                            setHoveredState(prev => prev === state.id ? null : prev)
                          }}
                          onClick={() => {
                            setSelectedState(selectedState === state.id ? null : state.id)
                            setSelectedCustomer(null)
                          }}
                        />
                      )
                    })}
                  </g>

                  {/* Active hovered/selected state overlay rendered on top to prevent adjacent path border clipping */}
                  <g id="active-state-borders-overlay" className="pointer-events-none">
                    {NIGERIA_MAP_PATHS.map((state) => {
                      const isHovered = hoveredState === state.id
                      const isSelected = selectedState === state.id
                      if (!isHovered && !isSelected) return null

                      const count = unfilteredCountsByState[state.id] || 0
                      const hasMatchingCustomers = (customersByState[state.id] || []).length > 0
                      
                      let fill = "#0c0d12"
                      if (count > 0) {
                        if (count <= 2) fill = "#1f2b2d"
                        else if (count <= 5) fill = "#394451"
                        else fill = "#cbd2db"
                      }

                      let stroke = "#ffffff"
                      let strokeWidth = "2.0"
                      if (fill === "#cbd2db") {
                        stroke = "#0c0d12"
                      }

                      let opacity = "1"
                      if (searchQuery && !hasMatchingCustomers) {
                        opacity = "0.2"
                      }

                      return (
                        <path
                          key={`overlay-${state.id}`}
                          d={state.d}
                          style={{ fill, stroke, strokeWidth, opacity }}
                          className="transition-all duration-75 ease-out"
                        />
                      )
                    })}
                  </g>

                  {/* SVG OVERLAY PINS */}
                  <g id="state-pins" className="pointer-events-none">
                    {Object.entries(STATE_CENTROIDS).map(([stateId, centroid]) => {
                      const stateCustomers = customersByState[stateId] || []
                      if (stateCustomers.length === 0) return null

                      const isHovered = hoveredState === stateId
                      const isSelected = selectedState === stateId
                      const isHighlighed = isHovered || isSelected || (selectedCustomer !== null && normalizeStateName(selectedCustomer.state) === stateId)

                      return (
                        <g 
                          key={`pin-${stateId}`} 
                          className="pointer-events-none"
                          style={{
                            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))'
                          }}
                        >
                           {/* Radial Glowing Aura rings */}
                           <circle
                             cx={centroid.x}
                             cy={centroid.y}
                             r={isHighlighed ? 18 : 14}
                             className="fill-white opacity-10"
                           >
                             <animate
                               attributeName="r"
                               values={`${isHighlighed ? 12 : 9};${isHighlighed ? 30 : 22}`}
                               dur="2s"
                               repeatCount="indefinite"
                             />
                             <animate
                               attributeName="opacity"
                               values="0.15;0"
                               dur="2s"
                               repeatCount="indefinite"
                             />
                           </circle>
                          <circle
                            cx={centroid.x}
                            cy={centroid.y}
                            r={isHighlighed ? 12 : 9}
                            className="fill-zinc-400/30 blur-[1px] transition-[r] duration-100 ease-out"
                          />
                          {/* Inner solid core */}
                          <circle
                            cx={centroid.x}
                            cy={centroid.y}
                            r={isHighlighed ? 6.5 : 5}
                            className="fill-white stroke-zinc-950 stroke-[1.5px] transition-[r] duration-100 ease-out"
                          />
                        </g>
                      )
                    })}
                  </g>
                </svg>

                {/* DYNAMIC RESPONSIVE HOVER POPUP CARD */}
                <div
                  ref={popupRef}
                  className="absolute z-10 w-72 bg-zinc-900/95 border border-zinc-750 rounded-xl shadow-2xl p-4 backdrop-blur-md transition-[opacity,transform] duration-150 ease-out"
                  style={{
                    left: activeCalloutCentroid ? `${(activeCalloutCentroid.x / 744) * 100}%` : '0px',
                    top: activeCalloutCentroid ? `${(activeCalloutCentroid.y / 600) * 100}%` : '0px',
                    transform: activeCalloutCentroid ? `
                      ${activeCalloutCentroid.x > 372 ? 'translate(-105%, 0)' : 'translate(15px, 0)'}
                      ${activeCalloutCentroid.y > 300 ? 'translate(0, -105%)' : 'translate(0, 15px)'}
                      scale(1)
                    ` : 'translate(0, 0) scale(0.95)',
                    opacity: displayCallout ? 1 : 0,
                    visibility: displayCallout ? 'visible' : 'hidden',
                    pointerEvents: selectedState ? 'auto' : 'none'
                  }}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start pb-2 border-b border-zinc-800 mb-2">
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        {activeCalloutCentroid?.label || ""}
                      </h4>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                        State Region
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-md border border-zinc-700">
                      {activeCalloutCustomers.length} {activeCalloutCustomers.length === 1 ? 'Customer' : 'Customers'}
                    </span>
                  </div>

                  {/* Customer Preview List */}
                  <div 
                    className="overflow-y-auto custom-scrollbar pr-1 space-y-2"
                    style={{ maxHeight: selectedState ? '220px' : '160px' }}
                  >
                    {(selectedState ? activeCalloutCustomers : activeCalloutCustomers.slice(0, 4)).map((c) => (
                      <div 
                        key={c.id} 
                        ref={selectedCustomer?.id === c.id ? popupSelectedRef : null}
                        onClick={() => setSelectedCustomer(selectedCustomer?.id === c.id ? null : c)}
                        className={`p-2 rounded-lg text-left transition-colors cursor-pointer ${
                          selectedCustomer?.id === c.id 
                            ? 'bg-zinc-800 border border-zinc-700 text-white font-medium' 
                            : 'bg-zinc-950/40 hover:bg-zinc-850/50 border border-transparent'
                        }`}
                      >
                        <p className={`font-semibold text-xs transition-colors ${selectedCustomer?.id === c.id ? 'text-white' : 'text-zinc-200'}`}>{c.name}</p>
                        <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-1">
                          <Building size={10} className="text-zinc-500" />
                          <span className="truncate">{c.city || 'N/A'}</span>
                        </div>
                        {c.contact_number && (
                          <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-0.5">
                            <Phone size={10} className="text-zinc-500" />
                            <span>{c.contact_number}</span>
                          </div>
                        )}
                        {selectedCustomer?.id === c.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/customers/${c.id}`)
                            }}
                            className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 bg-white hover:bg-zinc-200 text-black text-[10px] font-bold rounded transition-colors shadow"
                          >
                            <span>View Analytics</span>
                            <ChevronRight size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Overflow hint details - hide when clicked/selected and scrolling through all */}
                  {!selectedState && activeCalloutCustomers.length > 4 && (
                    <div className="mt-2 pt-2 border-t border-zinc-850 text-center">
                      <p className="text-[10px] text-zinc-400">
                        + {activeCalloutCustomers.length - 4} more customer{activeCalloutCustomers.length - 4 > 1 ? 's' : ''} in directory list
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Map Legend */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-zinc-950 border border-zinc-900 rounded-xl p-4 gap-4 mt-6 text-xs text-zinc-400">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <span className="font-semibold text-zinc-500 uppercase tracking-widest text-[10px] mt-1 sm:mt-0.5">Distribution Scale:</span>
                
                {/* 2-Column Grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                  {/* Column 1, Row 1: CORE */}
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded border border-zinc-850 inline-block" style={{ backgroundColor: '#0c0d12' }}></span>
                    <span className="text-[11px] font-medium text-zinc-400">
                      <span className="text-white uppercase font-bold tracking-wider text-[9px] mr-1">CORE</span>
                      (Obsidian)
                    </span>
                  </div>

                  {/* Column 2, Row 1: MODERATE */}
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded border border-zinc-800 inline-block" style={{ backgroundColor: '#1f2b2d' }}></span>
                    <span className="text-[11px] font-medium text-zinc-400">
                      <span className="text-white uppercase font-bold tracking-wider text-[9px] mr-1">MODERATE</span>
                      (Teal Graphite)
                    </span>
                  </div>

                  {/* Column 1, Row 2: HIGH (under CORE) */}
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded border border-zinc-750 inline-block" style={{ backgroundColor: '#394451' }}></span>
                    <span className="text-[11px] font-medium text-zinc-400">
                      <span className="text-white uppercase font-bold tracking-wider text-[9px] mr-1">HIGH</span>
                      (Indigo Charcoal)
                    </span>
                  </div>

                  {/* Column 2, Row 2: PEAK (under MODERATE) */}
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded border border-zinc-600 inline-block" style={{ backgroundColor: '#cbd2db' }}></span>
                    <span className="text-[11px] font-medium text-zinc-400">
                      <span className="text-white uppercase font-bold tracking-wider text-[9px] mr-1">PEAK</span>
                      (Pewter)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-zinc-900 pt-2 sm:pt-0 sm:pl-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-white inline-block"></span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Centroid Indicator</span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT PANEL: Search, Interactive Stats & Customer Directory */}
          <div id="directory-panel-right" className="lg:col-span-4 flex flex-col gap-6 w-full">
            
            {/* Customer Summary Statistics Cards */}
            <div className="grid grid-cols-2 gap-4 flex-shrink-0">
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300">
                  <Users size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Total Directory</span>
                  <span className="text-xl font-bold text-white leading-none">{stats.total}</span>
                </div>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300">
                  <MapPin size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Active States</span>
                  <span className="text-xl font-bold text-white leading-none">{stats.activeStates} / 37</span>
                </div>
              </div>
            </div>

            {/* Top State Hubs Mini-Dashboard */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <TrendingUp size={12} className="text-zinc-400" />
                Top Customer Hubs
              </h3>
              <div className="space-y-2">
                {stats.topHubs.map((hub, index) => {
                  const maxCount = stats.topHubs[0]?.count || 1
                  const widthPercent = (hub.count / maxCount) * 100
                  return (
                    <div 
                      key={hub.id} 
                      className="cursor-pointer group"
                      onClick={() => {
                        setSelectedState(hub.id)
                        setSelectedCustomer(null)
                      }}
                    >
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="font-semibold text-zinc-300 group-hover:text-white transition-colors">
                          {index + 1}. {hub.label}
                        </span>
                        <span className="font-bold text-zinc-400 group-hover:text-white transition-colors">
                          {hub.count} customers
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-900 border border-zinc-850 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-zinc-350 rounded-full group-hover:bg-white transition-all duration-300"
                          style={{ width: `${widthPercent}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Search & Directory Card Container */}
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-col p-5 shadow-sm">
              
               {/* Search Header */}
              <div className="relative mb-4 flex-shrink-0">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search customer, city or state..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 text-sm text-white placeholder-zinc-500 pl-10 pr-4 py-2.5 rounded-xl outline-none transition-colors"
                />
              </div>

              {/* Directory Header */}
              <div className="flex justify-between items-center text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 flex-shrink-0 px-1">
                <span>Customer Directory</span>
                <span>
                  {`Showing ${Math.min(visibleCount, filteredCustomers.length)} of ${filteredCustomers.length}`}
                </span>
              </div>

              {/* Scrollable Customer List */}
              <div 
                className="max-h-[260px] overflow-y-auto custom-scrollbar space-y-2 pr-1"
                onScroll={handleScroll}
              >
                {filteredCustomers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-zinc-900/10 border border-dashed border-zinc-900 rounded-xl">
                    <Users className="text-zinc-600 w-8 h-8 mb-2" />
                    <p className="text-sm font-semibold text-zinc-400">No Customers Found</p>
                    <p className="text-xs text-zinc-500 mt-1">Try modifying your search filter query</p>
                  </div>
                ) : (
                  <DirectoryList 
                    filteredCustomers={filteredCustomers.slice(0, visibleCount)}
                    selectedCustomer={selectedCustomer}
                    onCustomerClick={handleCustomerClick}
                    onViewProfile={(id) => navigate(`/customers/${id}`)}
                  />
                )}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  )
}
