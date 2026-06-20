import React, { useState, useEffect } from 'react'

export default function FlipDigit({ digit }) {
  const [topVal, setTopVal] = useState(digit)
  const [botVal, setBotVal] = useState(digit)
  const [flapVal, setFlapVal] = useState(digit)
  const [isFlipping, setIsFlipping] = useState(false)

  useEffect(() => {
    if (digit !== topVal) {
      setFlapVal(botVal)
      setTopVal(digit)
      setIsFlipping(true)

      const timer = setTimeout(() => {
        setBotVal(digit)
        setIsFlipping(false)
      }, 350) // must match the animation duration

      return () => clearTimeout(timer)
    }
  }, [digit])

  return (
    <div className="flip-digit select-none">
      {/* Static top half (shows new value) */}
      <div className="fd-top">
        <div className="fd-num-wrapper">
          <span className="fd-num">{topVal}</span>
        </div>
      </div>

      {/* Static bottom half (shows old value until flip completes) */}
      <div className="fd-bot">
        <div className="fd-num-wrapper">
          <span className="fd-num">{botVal}</span>
        </div>
      </div>

      {/* Animated top flap (flips down from 0 to -90 deg, showing old value) */}
      {isFlipping && (
        <div className="fd-flap animate-fd-flip">
          <div className="fd-num-wrapper">
            <span className="fd-num">{flapVal}</span>
          </div>
        </div>
      )}

      {/* Center hinge/line shadow */}
      <div className="absolute top-[calc(50%-1px)] left-0 right-0 h-[2px] bg-black z-20" />
    </div>
  )
}
