import React, { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { User, CreditCard, Menu } from 'lucide-react'
import FlipClock from './FlipClock'

export default function TopBar({ hideGreeting = false, onMenuToggle }) {
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

  const fullGreeting = `${greeting}, ${user?.full_name?.split(' ')[0] || 'Admin'}`

  return (
    <div className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-20">
      <div className="flex items-center justify-between pl-2 pr-8 py-6">
        {/* Left side - Greeting and Date */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Toggle */}
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2.5 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-650 text-zinc-300 flex-shrink-0 active:scale-95 transition-all"
            aria-label="Open Sidebar"
          >
            <Menu size={20} />
          </button>

          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-cyan-500/10">
            <User size={28} className="text-white" />
          </div>

          {/* Greeting and Date */}
          <div>
            <h2
              id="topbar-greeting"
              className="text-2xl font-bold text-white"
              style={{
                visibility: hideGreeting ? 'hidden' : 'visible',
                fontFamily: '"Lora", Georgia, serif',
                fontStyle: 'normal'
              }}
            >
              {fullGreeting.split('').map((char, i) => (
                <span key={i} data-topbar-char={i}>
                  {char}
                </span>
              ))}
            </h2>
            <p className="text-zinc-400 text-sm">
              {formatDate(currentTime)}
            </p>
          </div>
        </div>

        {/* Middle - Workday Countdown Flip Clock */}
        <FlipClock />

        {/* Right side - Account Info */}
        <div className="flex items-center gap-8">
          {/* User Profile Menu */}
          <div className="flex items-center gap-3 px-4 py-2 bg-zinc-800/50 rounded-lg border border-zinc-700 cursor-pointer hover:border-zinc-600 transition-colors">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <User size={20} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-white">
                {user?.full_name || 'Admin'}
              </p>
              <p className="text-xs text-zinc-400 capitalize">
                {user?.role || 'user'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
