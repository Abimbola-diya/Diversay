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
        @keyframes glowPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.8; }
        }
        @keyframes glowPulseSlow {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.55; }
        }
        @keyframes cornerGlowPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
        .dw-glow-top {
          position: absolute; top: 0; left: 5%; right: 5%; height: 2px;
          background: linear-gradient(90deg, transparent, #3b82f6, #06b6d4, #3b82f6, transparent);
          box-shadow: 0 0 30px 8px rgba(59,130,246,0.4), 0 0 80px 20px rgba(6,182,212,0.2);
          animation: glowPulse 3s ease-in-out infinite;
        }
        .dw-glow-bottom {
          position: absolute; bottom: 0; left: 5%; right: 5%; height: 2px;
          background: linear-gradient(90deg, transparent, #06b6d4, #3b82f6, #06b6d4, transparent);
          box-shadow: 0 0 30px 8px rgba(6,182,212,0.4), 0 0 80px 20px rgba(59,130,246,0.2);
          animation: glowPulse 3s ease-in-out infinite 0.5s;
        }
        .dw-glow-left {
          position: absolute; left: 0; top: 5%; bottom: 5%; width: 2px;
          background: linear-gradient(180deg, transparent, #3b82f6, #06b6d4, #3b82f6, transparent);
          box-shadow: 0 0 30px 8px rgba(59,130,246,0.4), 0 0 80px 20px rgba(6,182,212,0.2);
          animation: glowPulse 3s ease-in-out infinite 1s;
        }
        .dw-glow-right {
          position: absolute; right: 0; top: 5%; bottom: 5%; width: 2px;
          background: linear-gradient(180deg, transparent, #06b6d4, #3b82f6, #06b6d4, transparent);
          box-shadow: 0 0 30px 8px rgba(6,182,212,0.4), 0 0 80px 20px rgba(59,130,246,0.2);
          animation: glowPulse 3s ease-in-out infinite 1.5s;
        }
        /* Corner glow orbs */
        .dw-corner {
          position: absolute; width: 120px; height: 120px; border-radius: 50%;
          background: radial-gradient(circle, rgba(59,130,246,0.5), transparent 70%);
          animation: cornerGlowPulse 4s ease-in-out infinite;
          pointer-events: none;
        }
        .dw-corner-tl { top: -40px; left: -40px; animation-delay: 0s; }
        .dw-corner-tr { top: -40px; right: -40px; animation-delay: 1s; }
        .dw-corner-bl { bottom: -40px; left: -40px; animation-delay: 2s; }
        .dw-corner-br { bottom: -40px; right: -40px; animation-delay: 0.5s; }
        /* Ambient background glow */
        .dw-ambient {
          position: absolute; border-radius: 50%; filter: blur(100px); pointer-events: none;
          animation: glowPulseSlow 5s ease-in-out infinite;
        }
      `}</style>

      {/* ── Glowing edges ── */}
      <div className="dw-glow-top" />
      <div className="dw-glow-bottom" />
      <div className="dw-glow-left" />
      <div className="dw-glow-right" />

      {/* ── Corner orbs ── */}
      <div className="dw-corner dw-corner-tl" />
      <div className="dw-corner dw-corner-tr" />
      <div className="dw-corner dw-corner-bl" />
      <div className="dw-corner dw-corner-br" />

      {/* ── Ambient background glow ── */}
      <div className="dw-ambient" style={{
        top: '20%', left: '10%', width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)',
      }} />
      <div className="dw-ambient" style={{
        bottom: '15%', right: '8%', width: 350, height: 350,
        background: 'radial-gradient(circle, rgba(6,182,212,0.1), transparent 70%)',
        animationDelay: '2.5s',
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
