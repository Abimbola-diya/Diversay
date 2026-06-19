import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ── Funny quips based on time of day ──────────────────────────────────────
const MORNING_QUIPS = [
  "rise and grind! ☕",
  "early bird catches the orders! 🐦",
  "the logistics never sleep, huh? 😄",
  "coffee first, dashboard later? ☕",
  "time to move some goods! 📦",
]

const AFTERNOON_QUIPS = [
  "not yet tired, are you? 💪",
  "still keeping the wheels turning! 🚛",
  "halfway through — you've got this! 🔥",
  "lunch break's over, let's go! 🍔",
  "the afternoon hustle is real! ⚡",
]

const EVENING_QUIPS = [
  "burning the midnight oil? 🌙",
  "dedication at its finest! ✨",
  "the night shift hero! 🦸",
  "still here? That's commitment! 🫡",
  "wrapping up the day strong! 💫",
]

const NIGHT_QUIPS = [
  "the real ones work at night! 🌟",
  "can't stop, won't stop! 🚀",
  "you deserve a raise for this! 😅",
  "even the orders are sleeping! 😴",
  "dedication level: legendary! 🏆",
]

function getGreetingData() {
  const hour = new Date().getHours()

  if (hour >= 5 && hour < 12) {
    return {
      greeting: 'Good morning',
      quip: MORNING_QUIPS[Math.floor(Math.random() * MORNING_QUIPS.length)],
    }
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: 'Good afternoon',
      quip: AFTERNOON_QUIPS[Math.floor(Math.random() * AFTERNOON_QUIPS.length)],
    }
  } else if (hour >= 17 && hour < 21) {
    return {
      greeting: 'Good evening',
      quip: EVENING_QUIPS[Math.floor(Math.random() * EVENING_QUIPS.length)],
    }
  } else {
    return {
      greeting: 'Hello',
      quip: NIGHT_QUIPS[Math.floor(Math.random() * NIGHT_QUIPS.length)],
    }
  }
}

// ── Timing constants (ms) ─────────────────────────────────────────────────
const GLOW_WARMUP       = 600     // glow edges warm up
const TYPE_DELAY        = GLOW_WARMUP + 200
const TYPE_SPEED        = 48      // ms per character
const PAUSE_AFTER_TYPE  = 1800    // hold the full text
const SHRINK_DURATION   = 900     // CSS transition length for shrink
const FADE_OUT_DELAY    = 400     // after shrink, fade overlay out

// ── Component ──────────────────────────────────────────────────────────────
export default function DashboardWelcome({ userName, onComplete }) {
  const [phase, setPhase] = useState('glow')        // glow → typing → hold → shrink → done
  const [displayedText, setDisplayedText] = useState('')
  const [cursorVisible, setCursorVisible] = useState(true)
  const [overlayFading, setOverlayFading] = useState(false)
  const [showBlueGlow, setShowBlueGlow] = useState(false)

  const greetingRef = useRef(getGreetingData())
  const completeRef = useRef(onComplete)
  useEffect(() => { completeRef.current = onComplete }, [onComplete])

  const firstName = userName?.split(' ')[0] || 'Admin'
  const { greeting, quip } = greetingRef.current
  const fullText = `${greeting}, ${firstName}, ${quip}`

  // ── Cursor blink ────────────────────────────────────────────────────────
  useEffect(() => {
    const blink = setInterval(() => setCursorVisible(v => !v), 530)
    return () => clearInterval(blink)
  }, [])

  // ── Main animation sequencer ────────────────────────────────────────────
  useEffect(() => {
    const timers = []
    // 0. Transition from multi-color electron glow to blue glow after 2 seconds
    timers.push(setTimeout(() => setShowBlueGlow(true), 2000))

    // 1. After glow warmup → start typing
    timers.push(setTimeout(() => setPhase('typing'), TYPE_DELAY))

    // 2. Type characters one by one
    for (let i = 0; i <= fullText.length; i++) {
      timers.push(setTimeout(() => {
        setDisplayedText(fullText.slice(0, i))
      }, TYPE_DELAY + i * TYPE_SPEED))
    }

    const typingDone = TYPE_DELAY + fullText.length * TYPE_SPEED

    // 3. Hold the text for a moment
    timers.push(setTimeout(() => setPhase('hold'), typingDone))

    // 4. Shrink text to corner
    timers.push(setTimeout(() => setPhase('shrink'), typingDone + PAUSE_AFTER_TYPE))

    // 5. Fade overlay
    timers.push(setTimeout(() => setOverlayFading(true), typingDone + PAUSE_AFTER_TYPE + SHRINK_DURATION * 0.3))

    // 6. Done — unmount
    timers.push(setTimeout(() => {
      if (completeRef.current) completeRef.current()
    }, typingDone + PAUSE_AFTER_TYPE + SHRINK_DURATION + FADE_OUT_DELAY))

    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isShrunk = phase === 'shrink'

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        backgroundColor: '#18181b', // Exact blackish of the signup/login page
        opacity: overlayFading ? 0 : 1,
        transition: `opacity ${FADE_OUT_DELAY}ms ease-out`,
        pointerEvents: overlayFading ? 'none' : 'auto',
      }}
    >
      {/* ── Inline styles ── */}
      <style>{`
        /* ── Fast Electron Multi-color Border ── */
        .electron-border-container {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 3;
          opacity: 1;
          transition: opacity 0.8s ease-in-out;
        }
        .electron-border-container.inactive {
          opacity: 0;
        }
        .electron-glow-border {
          position: absolute;
          inset: 0;
          padding: 3.5px; /* thin 3.5px ribbon of light */
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          overflow: hidden;
        }
        /* Rotating child to move colors extremely fast along borders */
        .electron-rotator {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 200vmax;
          height: 200vmax;
          transform: translate(-50%, -50%);
          background: conic-gradient(
            #ef4444 0%,
            #fbbf24 15%,
            #10b981 30%,
            #3b82f6 45%,
            #8b5cf6 60%,
            #ec4899 75%,
            #ef4444 100%
          );
          animation: fastRotate 1.2s linear infinite;
        }
        @keyframes fastRotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        /* ── Blue Neon Glow Corners (Strictly restricted to corners) ── */
        .blue-glow-corners {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          opacity: 0;
          transition: opacity 1s ease-in-out;
        }
        .blue-glow-corners.active {
          opacity: 1;
        }
        @keyframes pulseCorner {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 0.95; }
        }
        .blue-corner-spot {
          position: absolute;
          width: 160px;
          height: 160px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(37, 99, 235, 0.45) 0%, rgba(37, 99, 235, 0.1) 45%, transparent 70%);
          filter: blur(12px);
          animation: pulseCorner 4s ease-in-out infinite;
        }
        .blue-corner-tl { top: -45px; left: -45px; animation-delay: 0s; }
        .blue-corner-tr { top: -45px; right: -45px; animation-delay: 1s; }
        .blue-corner-bl { bottom: -45px; left: -45px; animation-delay: 2s; }
        .blue-corner-br { bottom: -45px; right: -45px; animation-delay: 3s; }
      `}</style>

      {/* ── Multi-color Fast Electron Border (First 2 seconds) ── */}
      <div className={`electron-border-container ${showBlueGlow ? 'inactive' : ''}`}>
        <div className="electron-glow-border">
          <div className="electron-rotator" />
        </div>
      </div>

      {/* ── Soft Blue Neon Corners (Fades in after 2 seconds) ── */}
      <div className={`blue-glow-corners ${showBlueGlow ? 'active' : ''}`}>
        <div className="blue-corner-spot blue-corner-tl" />
        <div className="blue-corner-spot blue-corner-tr" />
        <div className="blue-corner-spot blue-corner-bl" />
        <div className="blue-corner-spot blue-corner-br" />
      </div>

      {/* ── Greeting text ── */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isShrunk ? 'flex-start' : 'center',
          // Center → top-left corner transition
          top:  isShrunk ? '28px' : '50%',
          left: isShrunk ? '88px' : '50%',
          transform: isShrunk
            ? 'translate(0, 0)'
            : 'translate(-50%, -50%)',
          transition: `all ${SHRINK_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
          zIndex: 10,
          whiteSpace: isShrunk ? 'nowrap' : 'normal',
          maxWidth: isShrunk ? '500px' : '90vw',
        }}
      >
        <h1
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontStyle: 'italic',
            fontSize: isShrunk ? '1.35rem' : 'clamp(1.8rem, 4vw, 3.2rem)',
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.01em',
            lineHeight: 1.35,
            textAlign: isShrunk ? 'left' : 'center',
            transition: `all ${SHRINK_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            textShadow: 'none', // No blue glow on the writing
          }}
        >
          {displayedText}
          {/* Blinking cursor */}
          {phase !== 'shrink' && (
            <span
              style={{
                display: 'inline-block',
                width: '3px',
                height: '1em',
                backgroundColor: '#ffffff', // Normal white cursor
                marginLeft: '6px',
                verticalAlign: 'text-bottom',
                opacity: cursorVisible ? 1 : 0,
                transition: 'opacity 0.1s',
              }}
            />
          )}
        </h1>
      </div>
    </div>,
    document.body
  )
}
