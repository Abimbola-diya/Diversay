import React, { useState, useEffect } from 'react'
import { Asterisk } from 'lucide-react'
import FlipDigit from './FlipDigit'

export default function FlipClock() {
  const [timeRemaining, setTimeRemaining] = useState({
    hours: '00',
    minutes: '00',
    seconds: '00',
    title: 'UNTIL WORKDAY ENDS'
  })

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date()
      let target = new Date()
      let title = 'UNTIL WORKDAY ENDS'

      const startHour = 8
      const endHour = 17

      const currentHour = now.getHours()

      if (currentHour < startHour) {
        // Before 8 AM today -> target is 8 AM today
        target.setHours(startHour, 0, 0, 0)
        title = 'UNTIL WORKDAY STARTS'
      } else if (currentHour >= startHour && currentHour < endHour) {
        // Between 8 AM and 5 PM today -> target is 5 PM today
        target.setHours(endHour, 0, 0, 0)
        title = 'UNTIL WORKDAY ENDS'
      } else {
        // After 5 PM today -> target is 8 AM tomorrow
        target.setDate(now.getDate() + 1)
        target.setHours(startHour, 0, 0, 0)
        title = 'UNTIL WORKDAY STARTS'
      }

      const diffMs = target - now
      const totalSecs = Math.max(0, Math.floor(diffMs / 1000))
      
      const hours = Math.floor(totalSecs / 3600)
      const minutes = Math.floor((totalSecs % 3600) / 60)
      const seconds = totalSecs % 60

      setTimeRemaining({
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0'),
        title
      })
    }

    calculateTime()
    const interval = setInterval(calculateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="hidden md:flex flex-col items-center gap-2 select-none py-1">
      {/* Title */}
      <span className="text-[10px] tracking-[0.3em] font-bold text-zinc-400 uppercase">
        {timeRemaining.title}
      </span>

      {/* Clock body */}
      <div className="flex items-center gap-3">
        {/* Hours group */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-[2px]">
            <FlipDigit digit={timeRemaining.hours[0]} />
            <FlipDigit digit={timeRemaining.hours[1]} />
          </div>
          <span className="text-[8px] tracking-[0.2em] font-semibold text-zinc-500 uppercase">
            HRS
          </span>
        </div>

        {/* Separator Colon */}
        <div className="flex flex-col gap-[2px] justify-center pb-3 h-[3.75rem] pulse-colon opacity-80">
          <Asterisk className="text-red-500 w-3 h-3" strokeWidth={4} />
          <Asterisk className="text-red-500 w-3 h-3" strokeWidth={4} />
        </div>

        {/* Minutes group */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-[2px]">
            <FlipDigit digit={timeRemaining.minutes[0]} />
            <FlipDigit digit={timeRemaining.minutes[1]} />
          </div>
          <span className="text-[8px] tracking-[0.2em] font-semibold text-zinc-500 uppercase">
            MINS
          </span>
        </div>

        {/* Separator Colon */}
        <div className="flex flex-col gap-[2px] justify-center pb-3 h-[3.75rem] pulse-colon opacity-80">
          <Asterisk className="text-red-500 w-3 h-3" strokeWidth={4} />
          <Asterisk className="text-red-500 w-3 h-3" strokeWidth={4} />
        </div>

        {/* Seconds group */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-[2px]">
            <FlipDigit digit={timeRemaining.seconds[0]} />
            <FlipDigit digit={timeRemaining.seconds[1]} />
          </div>
          <span className="text-[8px] tracking-[0.2em] font-semibold text-zinc-500 uppercase">
            SECS
          </span>
        </div>
      </div>
    </div>
  )
}
