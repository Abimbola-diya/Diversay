import React from 'react'
import OrdersTable from '../components/OrdersTable'

export default function OrdersPage() {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Orders</h1>
        <p className="text-zinc-400">Manage, search, and track all customer orders</p>
      </div>
      <OrdersTable />
    </div>
  )
}
