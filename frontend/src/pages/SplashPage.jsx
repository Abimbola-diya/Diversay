import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const BRAND = 'Diversay Solutions'
const LETTERS = BRAND.split('')

// ── Timing constants (ms) ─────────────────────────────────────────────────
const STAGGER = 70    // delay between consecutive letter drops
const LETTER_DUR = 700   // each letter's arcDrop animation
const INITIAL_DELAY = 600   // wait for font to load before cascade starts
const LETTERS_DONE = INITIAL_DELAY + LETTERS.length * STAGGER + LETTER_DUR

const RIPPLE_PAUSE = 350
const RIPPLE_STAGGER = 45
const RIPPLE_DUR = 560
const RIPPLE_SPAN = (LETTERS.length - 1) * RIPPLE_STAGGER + RIPPLE_DUR

const RIPPLE1_START = LETTERS_DONE + RIPPLE_PAUSE
const RIPPLE2_START = RIPPLE1_START + RIPPLE_SPAN + 220

const PROGRESS_START = RIPPLE2_START + RIPPLE_SPAN + 350
const PROGRESS_DUR = 4000
// Slide begins 800ms before NAV_DELAY so the animation finishes right as it unmounts
const SLIDE_START = PROGRESS_START + PROGRESS_DUR + 50
const NAV_DELAY = SLIDE_START + 850

// Phase names
const P = { DROP: 'drop', LAND: 'land', R1: 'r1', R2: 'r2', BAR: 'bar' }

// ── Component ──────────────────────────────────────────────────────────────
export default function SplashPage({ onStartLeaving, onComplete }) {
  const [phase, setPhase] = useState(P.DROP)
  const [barActive, setBarActive] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Keep refs up-to-date so the timer effect (which only runs once)
  // always calls the latest version of the callbacks without restarting.
  const startLeavingRef = useRef(onStartLeaving)
  const completeRef = useRef(onComplete)
  useEffect(() => { startLeavingRef.current = onStartLeaving }, [onStartLeaving])
  useEffect(() => { completeRef.current = onComplete }, [onComplete])

  useEffect(() => {
    const ts = [
      setTimeout(() => setPhase(P.LAND), LETTERS_DONE + 60),
      setTimeout(() => setPhase(P.R1), RIPPLE1_START),
      setTimeout(() => setPhase(P.LAND), RIPPLE1_START + RIPPLE_SPAN + 60),
      setTimeout(() => setPhase(P.R2), RIPPLE2_START),
      setTimeout(() => setPhase(P.LAND), RIPPLE2_START + RIPPLE_SPAN + 60),
      setTimeout(() => { setPhase(P.BAR); setBarActive(true) }, PROGRESS_START),
      setTimeout(() => {
        setLeaving(true)
        if (startLeavingRef.current) startLeavingRef.current()
      }, SLIDE_START),
      setTimeout(() => {
        if (completeRef.current) completeRef.current()
      }, NAV_DELAY),
    ]
    return () => ts.forEach(clearTimeout)
  }, []) // ← empty: timers set once on mount, refs keep callbacks current

  // ── Per-letter className + animationDelay ────────────────────────────────
  const letterProps = (i) => {
    switch (phase) {
      case P.DROP:
        return { cls: 'spl-drop', delay: INITIAL_DELAY + i * STAGGER }
      case P.R1:
        return { cls: 'spl-r1', delay: (LETTERS.length - 1 - i) * RIPPLE_STAGGER }
      case P.R2:
        return { cls: 'spl-r2', delay: i * RIPPLE_STAGGER }
      default:
        return { cls: 'spl-land', delay: 0 }
    }
  }

  const asteriskProps = () => {
    switch (phase) {
      case P.DROP: return { cls: 'spl-drop', delay: INITIAL_DELAY + LETTERS.length * STAGGER }
      case P.R1: return { cls: 'spl-r1', delay: 0 }
      case P.R2: return { cls: 'spl-r2', delay: LETTERS.length * RIPPLE_STAGGER }
      default: return { cls: 'spl-land', delay: 0 }
    }
  }

  const ast = asteriskProps()

  // Render via portal so it sits at document.body level — no parent
  // overflow/transform can clip or affect the overlay.
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#18181b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        // Slide the whole overlay upward when leaving
        transform: leaving ? 'translateY(-100%)' : 'translateY(0%)',
        transition: 'transform 0.8s cubic-bezier(0.77, 0, 0.175, 1)',
      }}
    >
      <style>{`
        @keyframes arcDrop {
          0%   { opacity:0; transform: translateY(-230px) translateX(-55px) rotate(-11deg) scaleY(1.28); }
          50%  { opacity:1; transform: translateY(20px)   translateX(0)      rotate(1.8deg)  scaleY(0.94); }
          65%  { transform: translateY(-11px) rotate(-1.1deg) scaleY(1.04); }
          78%  { transform: translateY(6px)   rotate( 0.5deg) scaleY(0.98); }
          89%  { transform: translateY(-3px)  rotate(-0.2deg) scaleY(1.01); }
          100% { opacity:1; transform: translateY(0) translateX(0) rotate(0) scaleY(1); }
        }
        @keyframes rippleWave {
          0%   { transform: translateY(0)     scaleY(1);    }
          20%  { transform: translateY(-38px) scaleY(0.86); }
          42%  { transform: translateY(12px)  scaleY(1.07); }
          62%  { transform: translateY(-7px)  scaleY(1.02); }
          80%  { transform: translateY(3px)   scaleY(0.99); }
          100% { transform: translateY(0)     scaleY(1);    }
        }
        @keyframes barGrow {
          from { width: 0%; }
          to   { width: 100%; }
        }
        .spl-drop {
          display: inline-block;
          opacity: 0;
          animation: arcDrop ${LETTER_DUR}ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
          will-change: transform, opacity;
        }
        .spl-land {
          display: inline-block;
          opacity: 1;
          transform: translateY(0) scaleY(1);
        }
        .spl-r1 {
          display: inline-block;
          opacity: 1;
          animation: rippleWave ${RIPPLE_DUR}ms cubic-bezier(0.33, 1, 0.68, 1) both;
        }
        .spl-r2 {
          display: inline-block;
          opacity: 1;
          animation: rippleWave ${RIPPLE_DUR}ms cubic-bezier(0.33, 1, 0.68, 1) both;
        }
        .spl-bar-fill {
          height: 100%;
          background: #ffffff;
          width: 0%;
          animation: barGrow ${PROGRESS_DUR}ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>

      {/* Brand row */}
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(3rem, 9vw, 6.5rem)',
            fontWeight: 700,
            fontStyle: 'normal',
            color: '#ffffff',
            display: 'flex',
            lineHeight: 1,
            letterSpacing: '0.01em',
          }}
        >
          {LETTERS.map((char, i) => {
            const { cls, delay } = letterProps(i)
            return (
              <span
                key={i}
                className={cls}
                style={{
                  animationDelay: `${delay}ms`,
                  width: char === ' ' ? '0.28em' : undefined,
                }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            )
          })}
        </div>

        {/* Red asterisk */}
        <span
          className={ast.cls}
          style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            fontSize: 'clamp(2rem, 5.5vw, 4.5rem)',
            fontWeight: 900,
            color: '#e53e3e',
            lineHeight: 1,
            animationDelay: `${ast.delay}ms`,
            marginLeft: '3px',
            alignSelf: 'flex-start',
          }}
        >
          *
        </span>
      </div>

      {/* Progress bar track */}
      <div
        style={{
          marginTop: '2.4rem',
          width: 'min(360px, 68vw)',
          height: '4px',
          backgroundColor: 'rgba(255, 255, 255, 0.18)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        {barActive && <div className="spl-bar-fill" />}
      </div>
    </div>,
    document.body
  )
}
