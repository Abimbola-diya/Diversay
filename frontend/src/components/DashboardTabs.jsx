import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getWithCache } from '../services/api'
import { AlertCircle, Clock, TrendingUp, Activity, ChevronRight, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardTabs() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('notifications')
  const [notifications, setNotifications] = useState([])
  const [activities, setActivities] = useState([])
  const [scheduledDeliveries, setScheduledDeliveries] = useState([])
  const [pendingIssues, setPendingIssues] = useState([])
  const [pendingIssuesCount, setPendingIssuesCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMorePending, setLoadingMorePending] = useState(false)
  const [hasMorePending, setHasMorePending] = useState(true)
  const [acknowledgingIds, setAcknowledgingIds] = useState([])
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const tabsRef = React.useRef({})
  const pendingScrollSentinelRef = useRef(null)
  const PENDING_PAGE_SIZE = 10

  useEffect(() => {
    fetchTabData()

    const handleOrderCreated = () => {
      fetchTabData(true)
    }

    window.addEventListener('order-created', handleOrderCreated)
    return () => {
      window.removeEventListener('order-created', handleOrderCreated)
    }
  }, [])

  const triggerAcknowledgeAnimation = (id, tabType) => {
    if (acknowledgingIds.includes(id)) return
    setAcknowledgingIds(prev => [...prev, id])
    setTimeout(() => {
      handleAcknowledge(id, tabType)
      setAcknowledgingIds(prev => prev.filter(x => x !== id))
    }, 600)
  }

  useEffect(() => {
    const updateIndicator = () => {
      const activeTabEl = tabsRef.current[activeTab]
      if (activeTabEl) {
        setIndicatorStyle({
          left: activeTabEl.offsetLeft,
          width: activeTabEl.offsetWidth
        })
      }
    }

    // Wait a brief tick for layout to complete
    const timer = setTimeout(updateIndicator, 50)

    window.addEventListener('resize', updateIndicator)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateIndicator)
    }
  }, [activeTab, loading, notifications, activities, scheduledDeliveries, pendingIssues])

  const fetchTabData = async (force = false) => {
    try {
      setLoading(true)

      // Fetch orders for notifications and issues
      let ordersRes
      if (force) {
        ordersRes = await api.get('/orders', { params: { limit: 100 } })
      } else {
        ordersRes = await getWithCache('/orders', { params: { limit: 100 } })
      }
      const orders = ordersRes.data.items || ordersRes.data || []

      // Fetch pending approvals for notifications
      let pendingUsers = []
      try {
        let approvalsRes
        if (force) {
          approvalsRes = await api.get('/auth/admin/pending-approvals')
        } else {
          approvalsRes = await getWithCache('/auth/admin/pending-approvals')
        }
        pendingUsers = approvalsRes.data.pending_users || approvalsRes.data?.pending_users || []
      } catch (e) {
        pendingUsers = []
      }

      // Fetch real system audit logs
      let auditLogs = []
      try {
        let auditLogsRes
        if (force) {
          auditLogsRes = await api.get('/analytics/audit-logs')
        } else {
          auditLogsRes = await getWithCache('/analytics/audit-logs')
        }
        auditLogs = auditLogsRes.data || []
      } catch (e) {
        console.error('Failed to load audit logs:', e)
      }

      // Fetch low-stock count first (instantaneous)
      let lowStockCount = 0
      try {
        let countRes
        if (force) {
          countRes = await api.get('/analytics/low-stock', { params: { count_only: true } })
        } else {
          countRes = await getWithCache('/analytics/low-stock', { params: { count_only: true } })
        }
        lowStockCount = countRes.data?.count || 0
        setPendingIssuesCount(lowStockCount)
      } catch (e) {
        console.error('Failed to load low-stock count:', e)
      }

      // Fetch first page of low-stock items for immediate display
      let lowStockItems = []
      try {
        let lowStockRes
        if (force) {
          lowStockRes = await api.get('/analytics/low-stock', { params: { limit: PENDING_PAGE_SIZE, offset: 0 } })
        } else {
          lowStockRes = await getWithCache('/analytics/low-stock', { params: { limit: PENDING_PAGE_SIZE, offset: 0 } })
        }
        lowStockItems = lowStockRes.data || []
        setHasMorePending(lowStockItems.length >= PENDING_PAGE_SIZE && lowStockItems.length < lowStockCount)
      } catch (e) {
        console.error('Failed to load low-stock items:', e)
      }

      // Fetch acknowledged notifications list from backend db
      let acknowledgedIds = []
      try {
        const acksRes = await api.get('/analytics/acknowledged')
        acknowledgedIds = acksRes.data || []
      } catch (e) {
        console.error('Failed to load acknowledgments from DB, falling back to local:', e)
        acknowledgedIds = JSON.parse(localStorage.getItem('acknowledged_notifications') || '[]')
      }

      // Process notifications: Only Overdue/Delayed orders (order-related only)
      const now = new Date()
      const notificationsList = orders
        .filter(o => o.order_status === 'Delayed' && !o.actual_delivery_time)
        .map(o => ({
          id: `delayed-${o.id}`,
          type: 'delayed',
          title: 'Overdue Delivery',
          message: `Order ${o.order_number} from ${o.customer_name} is overdue`,
          timestamp: o.expected_delivery_time,
          priority: 'high',
          order: o
        }))
        .filter(n => !acknowledgedIds.includes(n.id))
      setNotifications(notificationsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)))

      // Process activities from actual audit logs (only relating to orders)
      const activitiesList = auditLogs
        .filter(log => log.table_name === 'orders')
        .map(log => {
          let detailsObj = null
          try {
            detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details
          } catch (e) {}

          const actionText = detailsObj?.action || log.action.replace(/_/g, ' ')
          
          let message = `Record #${log.record_id} in ${log.table_name}`
          const snap = detailsObj?.state_snapshot
          if (snap) {
            message = `Order ${snap.order_number || ('ID ' + log.record_id)} for ${snap.customer_name || 'Customer'}`
          } else {
            message = `Order ID ${log.record_id}`
          }

          return {
            id: `activity-${log.id}`,
            orderId: log.record_id,
            type: 'audit_log',
            title: `${actionText} by ${log.user_name || 'Operator'}`,
            message: message,
            timestamp: log.timestamp,
            action: log.action
          }
        }).filter(act => !acknowledgedIds.includes(act.id)).slice(0, 10)
      setActivities(activitiesList)

      // Scheduled Deliveries: Orders with future expected delivery times
      const scheduled = orders.filter(o => {
        const expectedDate = new Date(o.expected_expected_delivery_time || o.expected_delivery_time)
        return expectedDate > now && !o.actual_delivery_time
      }).map(o => ({
        ...o,
        uniqueId: `scheduled-${o.id}`
      })).filter(o => !acknowledgedIds.includes(o.uniqueId)).slice(0, 10)
      setScheduledDeliveries(scheduled)

      // Pending Issues: Specifically for stock count (low-stock alerts, count limited for speed)
      const lowStockIssues = lowStockItems.map(item => ({
        type: 'lowstock',
        uniqueId: item.id,
        product_name: item.product_name,
        store_name: item.store_name,
        storeId: item.store_id,
        stock: item.stock,
        unit: item.unit,
        reorder_level: item.reorder_level,
        updated_at: item.updated_at
      }))
      
      setPendingIssues(lowStockIssues)
    } catch (err) {
      console.error('Failed to fetch tab data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadMorePendingIssues = useCallback(async () => {
    if (loadingMorePending || !hasMorePending) return
    setLoadingMorePending(true)
    try {
      const offset = pendingIssues.length
      const res = await api.get('/analytics/low-stock', { params: { limit: PENDING_PAGE_SIZE, offset } })
      const newItems = (res.data || []).map(item => ({
        type: 'lowstock',
        uniqueId: item.id,
        product_name: item.product_name,
        store_name: item.store_name,
        storeId: item.store_id,
        stock: item.stock,
        unit: item.unit,
        reorder_level: item.reorder_level,
        updated_at: item.updated_at
      }))
      if (newItems.length === 0 || newItems.length < PENDING_PAGE_SIZE) {
        setHasMorePending(false)
      }
      setPendingIssues(prev => {
        const existingIds = new Set(prev.map(i => i.uniqueId))
        const deduped = newItems.filter(i => !existingIds.has(i.uniqueId))
        return [...prev, ...deduped]
      })
    } catch (e) {
      console.error('Failed to load more pending issues:', e)
    } finally {
      setLoadingMorePending(false)
    }
  }, [loadingMorePending, hasMorePending, pendingIssues.length])

  // IntersectionObserver to trigger loading more pending issues on scroll
  useEffect(() => {
    if (activeTab !== 'pending') return
    const sentinel = pendingScrollSentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMorePending && !loadingMorePending) {
          loadMorePendingIssues()
        }
      },
      { root: sentinel.closest('.custom-scrollbar'), rootMargin: '100px', threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [activeTab, hasMorePending, loadingMorePending, loadMorePendingIssues])

  const handleAcknowledge = async (id, tabType) => {
    // 1. Update local state immediately for instant feedback
    if (tabType === 'notifications') {
      setNotifications(prev => prev.filter(n => n.id !== id))
    } else if (tabType === 'activities') {
      setActivities(prev => prev.filter(a => a.id !== id))
    } else if (tabType === 'scheduled') {
      setScheduledDeliveries(prev => prev.filter(o => o.uniqueId !== id))
    } else if (tabType === 'pending') {
      setPendingIssues(prev => prev.filter(o => o.uniqueId !== id))
      setPendingIssuesCount(prev => Math.max(0, prev - 1))
    }

    // 2. Post to backend DB
    try {
      await api.post('/analytics/acknowledge', { notification_id: id })
    } catch (e) {
      console.error('Failed to save acknowledgment to database:', e)
    }

    // 3. Also save to localStorage as a fallback
    try {
      const acknowledgedIds = JSON.parse(localStorage.getItem('acknowledged_notifications') || '[]')
      if (!acknowledgedIds.includes(id)) {
        const updated = [...acknowledgedIds, id]
        localStorage.setItem('acknowledged_notifications', JSON.stringify(updated))
      }
    } catch (e) {}
  }

  const tabs = [
    { id: 'notifications', label: 'Notifications', icon: AlertCircle, badge: notifications.length },
    { id: 'activities', label: 'Activities', icon: Activity, badge: activities.length },
    { id: 'scheduled', label: 'Scheduled Deliveries', icon: Clock, badge: scheduledDeliveries.length },
    { id: 'pending', label: 'Pending Issues', icon: TrendingUp, badge: pendingIssuesCount }
  ]

  const getStatusColor = (status) => {
    const colors = {
      'In Transit': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'Delayed': 'bg-red-500/10 text-red-400 border-red-500/20',
      'Delivered (On Time)': 'bg-green-500/10 text-green-400 border-green-500/20',
      'Delivered (Late)': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      'Draft': 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    }
    return colors[status] || colors['Draft']
  }

  const renderTabContent = () => {
    if (loading) {
      return <div className="py-8 text-center text-zinc-400">Loading...</div>
    }

    switch (activeTab) {
      case 'notifications':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">No notifications</div>
            ) : (
              notifications.map(notif => {
                const handleClick = () => {
                  handleAcknowledge(notif.id, 'notifications')
                  if (notif.type === 'approval') {
                    navigate('/admin/approvals')
                  } else if (notif.type === 'delayed' && notif.order?.id) {
                    navigate(`/orders/${notif.order.id}`)
                  } else if (notif.type === 'lowstock' && notif.storeId) {
                    navigate(`/stores/${notif.storeId}`)
                  }
                }
                return (
                  <div
                    key={notif.id}
                    onClick={handleClick}
                    className={`swipe-out-item ${acknowledgingIds.includes(notif.id) ? 'is-acknowledging' : ''} p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-zinc-600 cursor-pointer group`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white group-hover:text-zinc-300 transition-colors">
                            {notif.title}
                          </h4>
                          {notif.priority === 'high' && (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30 font-bold uppercase tracking-wider">
                              High
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-400 text-sm">{notif.message}</p>
                        <p className="text-zinc-550 text-[10px] font-semibold mt-2 text-zinc-500">
                          {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerAcknowledgeAnimation(notif.id, 'notifications')
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
                        >
                          <Check size={12} className="text-white" />
                          Acknowledge
                        </button>
                        <ChevronRight size={20} className="text-zinc-500 group-hover:text-zinc-400" />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )

      case 'activities':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
            {activities.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">No recent activities</div>
            ) : (
              activities.map(activity => {
                const handleClick = () => {
                  handleAcknowledge(activity.id, 'activities')
                  if (activity.orderId) {
                    navigate(`/orders/${activity.orderId}`)
                  }
                }
                return (
                  <div
                    key={activity.id}
                    onClick={handleClick}
                    className={`swipe-out-item ${acknowledgingIds.includes(activity.id) ? 'is-acknowledging' : ''} p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-zinc-600 cursor-pointer group`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white group-hover:text-zinc-300 transition-colors">
                          {activity.title || activity.action}
                        </h4>
                        <p className="text-zinc-400 text-sm">{activity.message}</p>
                        <p className="text-zinc-500 text-[10px] font-semibold mt-2 text-zinc-500">
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerAcknowledgeAnimation(activity.id, 'activities')
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
                        >
                          <Check size={12} className="text-white" />
                          Acknowledge
                        </button>
                        <ChevronRight size={20} className="text-zinc-500 group-hover:text-zinc-400" />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )

      case 'scheduled':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
            {scheduledDeliveries.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">No scheduled deliveries</div>
            ) : (
              scheduledDeliveries.map(order => {
                const handleClick = () => {
                  handleAcknowledge(order.uniqueId, 'scheduled')
                  if (order.id) {
                    navigate(`/orders/${order.id}`)
                  }
                }
                return (
                  <div
                    key={order.id}
                    onClick={handleClick}
                    className={`swipe-out-item ${acknowledgingIds.includes(order.uniqueId) ? 'is-acknowledging' : ''} p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-zinc-600 cursor-pointer group`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white group-hover:text-zinc-300 transition-colors">{order.customer_name}</h4>
                          <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded">
                            {order.order_number}
                          </span>
                        </div>
                        <p className="text-zinc-400 text-sm mt-1">
                          Expected delivery: {new Date(order.expected_delivery_time).toLocaleDateString()}
                        </p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {order.line_items?.slice(0, 2).map((item, idx) => (
                            <span key={idx} className="text-xs bg-zinc-750 text-zinc-300 px-2 py-1 rounded font-semibold">
                              {item.product_name} × {item.quantity}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerAcknowledgeAnimation(order.uniqueId, 'scheduled')
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
                        >
                          <Check size={12} className="text-white" />
                          Acknowledge
                        </button>
                        <ChevronRight size={20} className="text-zinc-500 group-hover:text-zinc-400" />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )

      case 'pending':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
            {pendingIssues.length === 0 && !loadingMorePending ? (
              <div className="py-8 text-center text-zinc-400">No pending issues</div>
            ) : (
              <>
                {pendingIssues.map(issue => {
                  const handleClick = () => {
                    handleAcknowledge(issue.uniqueId, 'pending')
                    navigate(`/store/${issue.storeId}`)
                  }
                  
                  const isDepleted = issue.stock <= 0
                  const bgClass = isDepleted 
                    ? 'bg-red-500/10 border-red-500/20 hover:border-red-500/40' 
                    : 'bg-yellow-500/10 border-yellow-500/20 hover:border-yellow-500/40'
                  const textClass = isDepleted ? 'text-red-400 group-hover:text-red-300' : 'text-yellow-400 group-hover:text-yellow-300'
                  const badgeClass = isDepleted 
                    ? 'bg-red-500/25 text-red-400 border border-red-500/30' 
                    : 'bg-yellow-500/25 text-yellow-400 border border-yellow-500/30'
                  const titleText = isDepleted ? `Depleted: ${issue.product_name}` : `Low Stock: ${issue.product_name}`
                  const statusText = isDepleted ? 'Stock Depleted (Restock Immediate)' : 'Below Threshold (Plan Restock)'
                  const chevronColor = isDepleted ? 'text-red-500 group-hover:text-red-400' : 'text-yellow-500 group-hover:text-yellow-400'

                  return (
                    <div
                      key={issue.uniqueId}
                      onClick={handleClick}
                      className={`swipe-out-item ${acknowledgingIds.includes(issue.uniqueId) ? 'is-acknowledging' : ''} p-4 border rounded-lg cursor-pointer group transition-all ${bgClass}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-semibold transition-colors ${textClass}`}>{titleText}</h4>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${badgeClass}`}>
                              {issue.store_name}
                            </span>
                          </div>
                          <p className="text-zinc-400 text-sm font-medium">
                            {issue.product_name} remains {issue.stock} {issue.unit.toLowerCase()}(s) in {issue.store_name} (threshold: {issue.reorder_level})
                          </p>
                          <p className={`text-xs mt-1.5 font-semibold ${textClass}`}>
                            Status: <span className="font-bold">{statusText}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              triggerAcknowledgeAnimation(issue.uniqueId, 'pending')
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
                          >
                            <Check size={12} className="text-white" />
                            Acknowledge
                          </button>
                          <ChevronRight size={20} className={`transition-all ${chevronColor}`} />
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Scroll sentinel + loading indicator */}
                <div ref={pendingScrollSentinelRef} className="py-2">
                  {loadingMorePending && (
                    <div className="flex items-center justify-center gap-2 py-3 text-zinc-500 text-sm">
                      <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                      Loading more issues...
                    </div>
                  )}
                  {!hasMorePending && pendingIssues.length > 0 && (
                    <div className="text-center text-zinc-600 text-xs py-2">
                      Showing all {pendingIssues.length} of {pendingIssuesCount} issues
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <style>{`
        .swipe-out-item {
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease-out, max-height 0.3s ease-out 0.25s, padding 0.3s ease-out 0.25s, margin 0.3s ease-out 0.25s, border-width 0.3s ease-out 0.25s;
          max-height: 250px;
          opacity: 1;
          transform: translateX(0);
        }
        .swipe-out-item.is-acknowledging {
          transform: translateX(120%);
          opacity: 0;
          max-height: 0 !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          border-top-width: 0 !important;
          border-bottom-width: 0 !important;
          pointer-events: none;
          overflow: hidden;
        }
      `}</style>
      {/* Tab Headers */}
      <div className="flex border-b border-zinc-800 overflow-x-auto relative scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              ref={el => tabsRef.current[tab.id] = el}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm whitespace-nowrap transition-colors relative z-10 ${activeTab === tab.id
                  ? 'text-white'
                  : 'text-zinc-400 hover:text-white'
                }`}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="ml-2 px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}

        {/* Sliding Indicator */}
        <div
          className="absolute bottom-0 h-[2px] bg-white transition-all duration-500 ease-out z-20"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`
          }}
        />
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {renderTabContent()}
      </div>
    </div>
  )
}
