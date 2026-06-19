import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { User, CreditCard } from 'lucide-react'

export default function TopBar() {
  const { user } = useAuth()
  const [greeting, setGreeting] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours()
      let greetingText = 'Hello'
      
      if (hour >= 5 && hour < 12) {
        greetingText = 'Good morning'
      } else if (hour >= 12 && hour < 17) {
        greetingText = 'Good afternoon'
      } else if (hour >= 17 && hour < 21) {
        greetingText = 'Good evening'
      } else {
        greetingText = 'Hello'
      }
      
      setGreeting(greetingText)
    }

    updateGreeting()
    const interval = setInterval(updateGreeting, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    
    return () => clearInterval(timer)
  }, [])

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20">
      <div className="flex items-center justify-between px-8 py-6">
        {/* Left side - Greeting and Date */}
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <User size={28} className="text-white" />
          </div>

          {/* Greeting and Date */}
          <div>
            <h2 className="text-2xl font-bold text-white">
              {greeting}, {user?.full_name?.split(' ')[0] || 'Admin'}
            </h2>
            <p className="text-slate-400 text-sm">
              {formatDate(currentTime)}
            </p>
          </div>
        </div>

        {/* Right side - Account Info */}
        <div className="flex items-center gap-8">
          {/* Account Balance */}
          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
            <CreditCard size={20} className="text-cyan-400" />
            <div>
              <p className="text-xs text-slate-400">Account balance</p>
              <p className="text-lg font-bold text-white">
                ${(Math.random() * 10000).toFixed(2)}
              </p>
            </div>
          </div>

          {/* User Profile Menu */}
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700 cursor-pointer hover:border-slate-600 transition-colors">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <User size={20} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-white">
                {user?.full_name || 'Admin'}
              </p>
              <p className="text-xs text-slate-400 capitalize">
                {user?.role || 'user'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
