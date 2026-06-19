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
  "halfway through, you've got this! 🔥",
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
const GLOW_WARMUP = 600     // glow edges warm up
const TYPE_DELAY = GLOW_WARMUP + 200
const TYPE_SPEED = 48      // ms per character
const PAUSE_AFTER_TYPE = 1800    // hold the full text
const SHRINK_DURATION = 900     // CSS transition length for shrink
const FADE_OUT_DELAY = 400     // after shrink, fade overlay out

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
          width: 220vmax;
          height: 220vmax;
          transform: translate(-50%, -50%);
          background: conic-gradient(
            from 0deg,
            #ef4444 0%,
            #fbbf24 8%,
            #10b981 16%,
            #3b82f6 24%,
            transparent 30%,
            transparent 100%
          );
          animation: fastRotate 2.0s linear infinite;
        }
        @keyframes fastRotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        /* ── Blue Neon Glow Thin Line Border (Fades in after 2 seconds) ── */
        .blue-border-container {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          opacity: 0;
          transition: opacity 1.0s ease-in-out;
          border: 3.5px solid rgba(59, 130, 246, 0.65);
          box-shadow: inset 0 0 32px rgba(59, 130, 246, 0.5), 0 0 32px rgba(59, 130, 246, 0.5);
          animation: neonPulse 4s ease-in-out infinite;
        }
        .blue-border-container.active {
          opacity: 1;
        }
        @keyframes neonPulse {
          0%, 100% {
            border-color: rgba(59, 130, 246, 0.55);
            box-shadow: inset 0 0 24px rgba(59, 130, 246, 0.4), 0 0 24px rgba(59, 130, 246, 0.4);
          }
          50% {
            border-color: rgba(59, 130, 246, 0.75);
            box-shadow: inset 0 0 45px rgba(59, 130, 246, 0.65), 0 0 45px rgba(59, 130, 246, 0.65);
          }
        }
      `}</style>

      {/* ── Multi-color Fast Electron Border (First 2 seconds) ── */}
      <div className={`electron-border-container ${showBlueGlow ? 'inactive' : ''}`}>
        <div className="electron-glow-border">
          <div className="electron-rotator" />
        </div>
      </div>

      {/* ── Soft Blue Neon Line Border (Fades in after 2 seconds) ── */}
      <div className={`blue-border-container ${showBlueGlow ? 'active' : ''}`} />

      {/* ── Greeting text ── */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isShrunk ? 'flex-start' : 'center',
          // Center → top-left corner transition
          top: isShrunk ? '28px' : '50%',
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
