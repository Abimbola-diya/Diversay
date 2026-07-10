import React, { useState, useEffect } from 'react'
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
  const [loading, setLoading] = useState(true)
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const tabsRef = React.useRef({})

  useEffect(() => {
    fetchTabData()
  }, [])

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

  const fetchTabData = async () => {
    try {
      setLoading(true)

      // Fetch orders for notifications and issues
      const ordersRes = await getWithCache('/orders', { params: { limit: 100 } })
      const orders = ordersRes.data.items || ordersRes.data || []

      // Fetch pending approvals for notifications
      let pendingUsers = []
      try {
        const approvalsRes = await getWithCache('/auth/admin/pending-approvals')
        pendingUsers = approvalsRes.data.pending_users || approvalsRes.data?.pending_users || []
      } catch (e) {
        pendingUsers = []
      }

      // Process notifications: Pending approvals + Overdue orders
      const now = new Date()
      const acknowledgedIds = JSON.parse(localStorage.getItem('acknowledged_notifications') || '[]')
      const notificationsList = [
        ...pendingUsers.map(user => ({
          id: `approval-${user.id}`,
          type: 'approval',
          title: 'Pending Admin Request',
          message: `${user.full_name} (${user.email}) is requesting admin access`,
          timestamp: user.created_at,
          priority: 'high'
        })),
        ...orders
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
      ].filter(n => !acknowledgedIds.includes(n.id))
      setNotifications(notificationsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)))

      // Process activities: Recent order status changes (mock - in production would come from audit logs)
      const activitiesList = orders.map(o => ({
        id: `activity-${o.id}`,
        orderId: o.id,
        type: 'order_update',
        title: `Order ${o.order_status.toLowerCase()}`,
        message: `${o.customer_name} - ${o.order_number}`,
        timestamp: o.updated_at,
        action: o.order_status
      })).filter(act => !acknowledgedIds.includes(act.id)).slice(0, 10)
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

      // Pending Issues: All delayed orders
      const delayed = orders.filter(o => o.order_status === 'Delayed')
        .map(o => ({
          ...o,
          uniqueId: `pending-${o.id}`
        })).filter(o => !acknowledgedIds.includes(o.uniqueId)).slice(0, 10)
      setPendingIssues(delayed)
    } catch (err) {
      console.error('Failed to fetch tab data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAcknowledge = (id, tabType) => {
    const acknowledgedIds = JSON.parse(localStorage.getItem('acknowledged_notifications') || '[]')
    if (!acknowledgedIds.includes(id)) {
      const updated = [...acknowledgedIds, id]
      localStorage.setItem('acknowledged_notifications', JSON.stringify(updated))
    }
    if (tabType === 'notifications') {
      setNotifications(prev => prev.filter(n => n.id !== id))
    } else if (tabType === 'activities') {
      setActivities(prev => prev.filter(a => a.id !== id))
    } else if (tabType === 'scheduled') {
      setScheduledDeliveries(prev => prev.filter(o => o.uniqueId !== id))
    } else if (tabType === 'pending') {
      setPendingIssues(prev => prev.filter(o => o.uniqueId !== id))
    }
  }

  const tabs = [
    { id: 'notifications', label: 'Notifications', icon: AlertCircle, badge: notifications.length },
    { id: 'activities', label: 'Activities', icon: Activity, badge: activities.length },
    { id: 'scheduled', label: 'Scheduled Deliveries', icon: Clock, badge: scheduledDeliveries.length },
    { id: 'pending', label: 'Pending Issues', icon: TrendingUp, badge: pendingIssues.length }
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
                  }
                }
                return (
                  <div
                    key={notif.id}
                    onClick={handleClick}
                    className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors cursor-pointer group"
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
                            handleAcknowledge(notif.id, 'notifications')
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
                    className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white capitalize group-hover:text-zinc-300 transition-colors">
                          {activity.action}
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
                            handleAcknowledge(activity.id, 'activities')
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
                    className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors cursor-pointer group"
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
                            handleAcknowledge(order.uniqueId, 'scheduled')
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
            {pendingIssues.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">No pending issues</div>
            ) : (
              pendingIssues.map(order => {
                const handleClick = () => {
                  handleAcknowledge(order.uniqueId, 'pending')
                  if (order.id) {
                    navigate(`/orders/${order.id}`)
                  }
                }
                return (
                  <div
                    key={order.id}
                    onClick={handleClick}
                    className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg hover:border-red-500/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-red-400 group-hover:text-red-300 transition-colors">{order.customer_name}</h4>
                          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30 font-bold">
                            {order.order_number}
                          </span>
                        </div>
                        <p className="text-zinc-400 text-sm">
                          Expected: {new Date(order.expected_delivery_time).toLocaleDateString()}
                        </p>
                        <p className="text-red-400 text-xs mt-1 font-semibold">
                          Status: <span className="font-bold">{order.order_status}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAcknowledge(order.uniqueId, 'pending')
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-[0_2px_8px_rgba(16,185,129,0.15)]"
                        >
                          <Check size={12} className="text-white" />
                          Acknowledge
                        </button>
                        <ChevronRight size={20} className="text-red-500 group-hover:text-red-400" />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
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
