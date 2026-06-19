import React, { useState, useEffect } from 'react'
import api from '../services/api'
import { AlertCircle, Clock, TrendingUp, Activity, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardTabs() {
  const [activeTab, setActiveTab] = useState('notifications')
  const [notifications, setNotifications] = useState([])
  const [activities, setActivities] = useState([])
  const [scheduledDeliveries, setScheduledDeliveries] = useState([])
  const [pendingIssues, setPendingIssues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTabData()
  }, [])

  const fetchTabData = async () => {
    try {
      setLoading(true)

      // Fetch orders for notifications and issues
      const ordersRes = await api.get('/orders?limit=100')
      const orders = ordersRes.data.items || []

      // Fetch pending approvals for notifications
      const approvalsRes = await api.get('/auth/admin/pending-approvals').catch(() => ({ data: { pending_users: [] } }))
      const pendingUsers = approvalsRes.data.pending_users || []

      // Process notifications: Pending approvals + Overdue orders
      const now = new Date()
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
      ]
      setNotifications(notificationsList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)))

      // Process activities: Recent order status changes (mock - in production would come from audit logs)
      const activitiesList = orders.slice(0, 10).map(o => ({
        id: o.id,
        type: 'order_update',
        title: `Order ${o.order_status.toLowerCase()}`,
        message: `${o.customer_name} - ${o.order_number}`,
        timestamp: o.updated_at,
        action: o.order_status
      }))
      setActivities(activitiesList)

      // Scheduled Deliveries: Orders with future expected delivery times
      const scheduled = orders.filter(o => {
        const expectedDate = new Date(o.expected_delivery_time)
        return expectedDate > now && !o.actual_delivery_time
      }).slice(0, 10)
      setScheduledDeliveries(scheduled)

      // Pending Issues: All delayed orders
      const delayed = orders.filter(o => o.order_status === 'Delayed').slice(0, 10)
      setPendingIssues(delayed)
    } catch (err) {
      console.error('Failed to fetch tab data:', err)
    } finally {
      setLoading(false)
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
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">No notifications</div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                          {notif.title}
                        </h4>
                        {notif.priority === 'high' && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30">
                            High
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-400 text-sm">{notif.message}</p>
                      <p className="text-zinc-500 text-xs mt-2">
                        {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    <ChevronRight size={20} className="text-zinc-500 group-hover:text-zinc-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        )

      case 'activities':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {activities.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">No recent activities</div>
            ) : (
              activities.map(activity => (
                <div
                  key={activity.id}
                  className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white capitalize">
                        {activity.action}
                      </h4>
                      <p className="text-zinc-400 text-sm">{activity.message}</p>
                      <p className="text-zinc-500 text-xs mt-2">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )

      case 'scheduled':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {scheduledDeliveries.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">No scheduled deliveries</div>
            ) : (
              scheduledDeliveries.map(order => (
                <div
                  key={order.id}
                  className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">{order.customer_name}</h4>
                        <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded">
                          {order.order_number}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-sm">
                        Expected delivery: {new Date(order.expected_delivery_time).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {order.line_items?.slice(0, 2).map((item, idx) => (
                          <span key={idx} className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded">
                            {item.product_name} × {item.quantity}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-zinc-500" />
                  </div>
                </div>
              ))
            )}
          </div>
        )

      case 'pending':
        return (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pendingIssues.length === 0 ? (
              <div className="py-8 text-center text-zinc-400">No pending issues</div>
            ) : (
              pendingIssues.map(order => (
                <div
                  key={order.id}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg hover:border-red-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-red-400">{order.customer_name}</h4>
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30">
                          {order.order_number}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-sm">
                        Expected: {new Date(order.expected_delivery_time).toLocaleDateString()}
                      </p>
                      <p className="text-red-400 text-xs mt-1">
                        Status: <strong>{order.order_status}</strong>
                      </p>
                    </div>
                    <ChevronRight size={20} className="text-red-500" />
                  </div>
                </div>
              ))
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
      <div className="flex border-b border-zinc-800 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-zinc-400 hover:text-white'
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
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {renderTabContent()}
      </div>
    </div>
  )
}
