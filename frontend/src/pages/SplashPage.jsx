import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Timing constants (ms)
const LOGO_FADE_IN = 600
const TEXT_DELAY = 900
const PROGRESS_START = 1400
const PROGRESS_DUR = 7400
const SLIDE_START = PROGRESS_START + PROGRESS_DUR + 300
const NAV_DELAY = SLIDE_START + 750

export default function SplashPage({ onStartLeaving, onComplete }) {
  const [visible, setVisible] = useState(false)
  const [textVisible, setTextVisible] = useState(false)
  const [barActive, setBarActive] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [percent, setPercent] = useState(0)

  const startLeavingRef = useRef(onStartLeaving)
  const completeRef = useRef(onComplete)
  useEffect(() => { startLeavingRef.current = onStartLeaving }, [onStartLeaving])
  useEffect(() => { completeRef.current = onComplete }, [onComplete])

  useEffect(() => {
    const t0 = setTimeout(() => setVisible(true), 80)
    const tText = setTimeout(() => setTextVisible(true), TEXT_DELAY)
    const t1 = setTimeout(() => setBarActive(true), PROGRESS_START)
    const t2 = setTimeout(() => {
      setLeaving(true)
      if (startLeavingRef.current) startLeavingRef.current()
    }, SLIDE_START)
    const t3 = setTimeout(() => {
      if (completeRef.current) completeRef.current()
    }, NAV_DELAY)
    return () => { clearTimeout(t0); clearTimeout(tText); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  // Animate percentage counter
  useEffect(() => {
    if (!barActive) return
    const start = performance.now()
    let raf
    const tick = (now) => {
      const elapsed = now - start
      const p = Math.min(100, Math.round((elapsed / PROGRESS_DUR) * 100))
      setPercent(p)
      if (p < 100) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [barActive])

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#18181b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        transform: leaving ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.75s cubic-bezier(0.77, 0, 0.175, 1)',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap');

        @keyframes splBarGrow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes splTextReveal {
          0% {
            opacity: 0;
            transform: translateY(14px);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }
        @keyframes splLineExpand {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
      `}</style>

      {/* Logo — shifted up */}
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(-20px)' : 'scale(0.92) translateY(-20px)',
          transition: `opacity ${LOGO_FADE_IN}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${LOGO_FADE_IN}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          width: 'clamp(380px, 68vw, 680px)',
        }}
      >
        <svg width="684" height="252" viewBox="0 0 684 252" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto', display: 'block' }}>
          <path d="M321.007 49.6339C312.259 49.8485 303.507 49.8862 294.758 49.747C291.715 49.723 284.561 49.8485 281.778 49.5077L281.811 49.0177C283.356 47.7207 296.422 41.7541 299.207 40.434L323.86 28.9803C330.967 25.61 337.862 22.0228 345.214 19.1262C349.571 17.4088 350.772 17.4789 355.028 19.5913C365.045 24.5631 374.675 30.229 384.486 35.5839C390.607 38.8699 404.754 45.483 409.737 49.6298L385.463 49.7143C381.604 49.7083 373.158 49.4776 369.608 50.1362C369.378 56.3798 369.412 151.449 369.885 152.405C369.121 154.984 369.522 174.181 369.452 178.258L402.185 178.218C403.666 178.211 410.328 177.838 411.292 178.084C412.032 178.352 412.502 178.424 413.29 178.423L503.081 177.99L536.732 178C542.873 178.002 550.415 178.223 556.439 177.802C556.702 168.685 556.212 157.007 557.169 148.047L557.476 147.838C558.037 148.278 562.977 155.199 564.044 156.501C573.815 168.433 583.578 180.395 593.279 192.385C593.896 193.149 595.65 195.587 595.744 196.532C595.814 197.209 594.313 199.768 593.819 200.389C589.436 205.93 585.023 211.565 580.633 217.101L557.036 247.154C557.026 246.271 556.996 245.381 556.943 244.499C556.379 235.18 556.486 225.907 556.526 216.575C545.328 216.823 533.326 216.594 522.044 216.604L455.834 216.604L254.706 216.6L175.456 216.612L150.833 216.557C145.743 216.546 139.082 216.413 134.119 216.914C133.883 226.266 134.39 237.427 133.746 246.472C129.426 242.839 124.672 235.384 120.821 230.675C113.012 221.028 105.318 211.253 97.7056 201.45C95.2882 198.337 94.1143 196.517 96.7609 193.314C107.45 180.379 117.723 167.129 128.362 154.151C130.078 152.057 132.117 150.599 133.441 148.331L133.522 148.19C134.444 150.24 134.169 168.926 134.158 172.471C134.27 173.585 134.476 174.697 134.132 175.755L134.461 177.256C136.004 178.242 158.548 177.92 162.508 177.925L208.961 177.938C229.287 177.938 251.913 178.587 272.027 177.979C274.492 178.299 278.19 178.223 280.725 178.244C281.85 178.253 281.965 178.096 282.558 177.43C283.555 177.511 283.753 177.59 284.694 177.945C288.146 178.41 294.342 178.235 298.004 178.237L320.987 178.233C321.088 168.826 321.058 159.417 320.897 150.011C321.592 141.629 321.114 126.566 321.109 117.5L321.007 49.6339Z" fill="#FE0100"/>
          <path d="M134.158 172.471C134.27 173.585 134.476 174.697 134.132 175.755L134.461 177.257C136.004 178.242 158.547 177.92 162.508 177.925L208.96 177.938C229.286 177.938 251.913 178.587 272.027 177.979C274.491 178.3 278.189 178.223 280.725 178.244C281.85 178.253 281.965 178.096 282.558 177.43C283.555 177.511 283.752 177.59 284.694 177.945C282.131 179.522 204.23 178.982 194.047 178.987L158.661 178.998C150.541 178.999 142.005 179.122 133.919 178.696C133.892 176.816 134.07 174.39 134.158 172.471Z" fill="#690003"/>
          <path d="M444.782 63.5029C461.727 69.8704 478.593 76.4534 495.371 83.25C500.132 85.1359 512.874 89.3007 516.163 91.8317C517.361 99.8967 517.15 108.128 517.811 116.098C518.835 128.43 519.415 140.984 520.493 153.252C515.709 147.917 511.019 142.251 506.349 136.805C502.75 132.608 500.051 128.919 495.882 125.145C490.658 129.581 477.772 136.498 471.594 140.366L411.291 178.084C410.327 177.838 403.666 178.211 402.185 178.218L369.451 178.258C369.521 174.181 369.121 154.984 369.885 152.405C374.959 149.373 379.468 146.251 384.355 143.272L438.951 109.967C447.264 104.844 455.556 99.7072 464.029 94.8531C465.737 93.8744 467.235 92.9903 468.799 91.7693C461.354 84.8652 452.364 70.9237 444.782 63.5029Z" fill="#CD9933"/>
          <path d="M198.206 125.045C195.925 128.075 176.284 151.591 175.017 151.94C174.358 150.941 178.008 95.5795 179.428 91.5902C180.824 89.9503 206.259 80.4284 209.853 79.0129L233.033 70.1118C238.836 67.8554 243.74 65.6799 249.701 63.7363C242.025 73.1922 234.206 82.5305 226.245 91.748C230.759 95.4443 241.821 101.257 247.276 104.715C271.705 119.992 296.246 135.092 320.896 150.011C321.057 159.418 321.088 168.826 320.987 178.233L298.004 178.237C294.342 178.235 288.146 178.41 284.694 177.945C283.752 177.59 283.555 177.511 282.558 177.43C276.446 173.078 264.941 166.494 258.386 162.389L198.206 125.045Z" fill="#CD9933"/>
        </svg>
      </div>

      {/* Title text — staggered word reveal */}
      <div
        style={{
          marginTop: '8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0',
        }}
      >
        {/* Thin decorative line */}
        <div
          style={{
            width: 'min(200px, 40vw)',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(205,153,51,0.5), transparent)',
            transformOrigin: 'center',
            animation: textVisible ? 'splLineExpand 800ms cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
            transform: textVisible ? undefined : 'scaleX(0)',
            marginBottom: '18px',
          }}
        />

        {/* "DIVERSAY SOLUTIONS" — bold, tracked */}
        <div
          style={{
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontFamily: '"Inter", -apple-system, sans-serif',
              fontSize: 'clamp(18px, 3vw, 28px)',
              fontWeight: 500,
              letterSpacing: '0.28em',
              color: '#ffffff',
              textTransform: 'uppercase',
              animation: textVisible ? 'splTextReveal 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
              opacity: textVisible ? undefined : 0,
            }}
          >
            <span>DIVERSAY</span>
            <span style={{ color: 'rgba(205, 153, 51, 0.85)', marginLeft: '0.3em' }}>SOLUTIONS</span>
          </div>
        </div>

        {/* "Logistics Dashboard" — light, elegant */}
        <div
          style={{
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontFamily: '"Inter", -apple-system, sans-serif',
              fontSize: 'clamp(11px, 1.6vw, 14px)',
              fontWeight: 300,
              letterSpacing: '0.35em',
              color: 'rgba(255, 255, 255, 0.4)',
              textTransform: 'uppercase',
              marginTop: '6px',
              animation: textVisible ? 'splTextReveal 700ms cubic-bezier(0.16, 1, 0.3, 1) 150ms forwards' : 'none',
              opacity: textVisible ? undefined : 0,
            }}
          >
            Logistics Dashboard
          </div>
        </div>
      </div>

      {/* Progress bar + percentage */}
      <div
        style={{
          marginTop: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          opacity: visible ? 1 : 0,
          transition: `opacity 400ms ease ${PROGRESS_START}ms`,
        }}
      >
        <div
          style={{
            width: 'min(320px, 60vw)',
            height: '7px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          {barActive && (
            <div
              style={{
                height: '100%',
                backgroundColor: '#ffffff',
                borderRadius: '2px',
                transformOrigin: 'left',
                animation: `splBarGrow ${PROGRESS_DUR}ms cubic-bezier(0.4, 0, 0.2, 1) forwards`,
              }}
            />
          )}
        </div>
        <span
          style={{
            fontFamily: '"Inter", -apple-system, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.4)',
            letterSpacing: '0.05em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {percent}%
        </span>
      </div>
    </div>,
    document.body
  )
}
