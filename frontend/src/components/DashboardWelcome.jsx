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

  const greetingRef = useRef(getGreetingData())
  const completeRef = useRef(onComplete)
  useEffect(() => { completeRef.current = onComplete }, [onComplete])

  const firstName = userName?.split(' ')[0] || 'Admin'
  const { greeting, quip } = greetingRef.current
  const fullText = `${greeting}, ${firstName} — ${quip}`

  // ── Cursor blink ────────────────────────────────────────────────────────
  useEffect(() => {
    const blink = setInterval(() => setCursorVisible(v => !v), 530)
    return () => clearInterval(blink)
  }, [])

  // ── Main animation sequencer ────────────────────────────────────────────
  useEffect(() => {
    const timers = []

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
        backgroundColor: '#0a0a0f',
        opacity: overlayFading ? 0 : 1,
        transition: `opacity ${FADE_OUT_DELAY}ms ease-out`,
        pointerEvents: overlayFading ? 'none' : 'auto',
      }}
    >
      {/* ── Inline styles ── */}
      <style>{`
        @keyframes geminiShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.75; }
        }
        .gemini-border-container {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
        }
        .gemini-glow-border {
          position: absolute;
          inset: 0;
          padding: 3.5px; /* thin 3.5px ribbon of light */
          background: linear-gradient(
            270deg,
            #3b82f6, /* twilight blue */
            #8b5cf6, /* royal purple */
            #ec4899, /* pink */
            #fbbf24, /* warm yellow */
            #10b981, /* emerald green */
            #ef4444, /* bright red */
            #3b82f6
          );
          background-size: 300% 300%;
          animation: geminiShift 8s ease-in-out infinite;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
        }
        .gemini-glow-blur {
          position: absolute;
          inset: 0;
          padding: 3.5px;
          background: linear-gradient(
            270deg,
            #3b82f6,
            #8b5cf6,
            #ec4899,
            #fbbf24,
            #10b981,
            #ef4444,
            #3b82f6
          );
          background-size: 300% 300%;
          animation: geminiShift 8s ease-in-out infinite, pulseGlow 4s ease-in-out infinite;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          filter: blur(10px);
          transform: scale(1.005);
        }
        /* Ambient background glow */
        @keyframes glowPulseSlow {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.35; }
        }
        .dw-ambient {
          position: absolute; border-radius: 50%; filter: blur(100px); pointer-events: none;
          animation: glowPulseSlow 6s ease-in-out infinite;
        }
      `}</style>

      {/* ── Google Gemini Edge Glow ── */}
      <div className="gemini-border-container">
        <div className="gemini-glow-border" />
        <div className="gemini-glow-blur" />
      </div>

      {/* ── Ambient background glow ── */}
      <div className="dw-ambient" style={{
        top: '20%', left: '10%', width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(59,130,246,0.1), transparent 70%)',
      }} />
      <div className="dw-ambient" style={{
        bottom: '15%', right: '8%', width: 350, height: 350,
        background: 'radial-gradient(circle, rgba(139,92,246,0.08), transparent 70%)',
        animationDelay: '2s',
      }} />

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
            fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
            fontSize: isShrunk ? '1.35rem' : 'clamp(1.8rem, 4vw, 3.2rem)',
            fontWeight: isShrunk ? 600 : 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
            textAlign: isShrunk ? 'left' : 'center',
            transition: `all ${SHRINK_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            textShadow: isShrunk
              ? 'none'
              : '0 0 40px rgba(59,130,246,0.3), 0 0 80px rgba(6,182,212,0.15)',
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
                backgroundColor: '#3b82f6',
                marginLeft: '4px',
                verticalAlign: 'text-bottom',
                opacity: cursorVisible ? 1 : 0,
                transition: 'opacity 0.1s',
                boxShadow: '0 0 8px rgba(59,130,246,0.6)',
              }}
            />
          )}
        </h1>
      </div>
    </div>,
    document.body
  )
}
