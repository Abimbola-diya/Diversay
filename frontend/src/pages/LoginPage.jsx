import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Shield, User, Eye, EyeOff, UserPlus, ArrowRight } from 'lucide-react'
import SplashPage from './SplashPage'

const FULL_TEXT = "Ready to start working? sign in here"

const COLORS = [
  { textClass: 'text-teal-400',   hex: '#2dd4bf' }, // Teal
  { textClass: 'text-purple-400', hex: '#c084fc' }, // Purple
  { textClass: 'text-green-400',  hex: '#4ade80' }, // Green
  { textClass: 'text-rose-400',   hex: '#f0435dff' }, // Coral
  { textClass: 'text-amber-400',  hex: '#facc15' }, // Gold
  { textClass: 'text-blue-400',  hex: '#68a9d7ff' }, // Blue
]

export default function LoginPage() {
  const [isReady, setIsReady] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedRole = searchParams.get('role')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const skipSplash = location.state?.skipSplash || false

  // Splash-screen state
  const [showSplash,    setShowSplash]    = useState(!skipSplash)
  const [slideLoginUp,  setSlideLoginUp]  = useState(skipSplash)

  // 3 groups: 0 = "Ready to start", 1 = "working?", 2 = "sign in here"
  const GROUPS = [
    [0, 1, 2],       // "Ready to start"
    [3],             // "working?"
    [4, 5, 6],       // "sign in here"
  ]

  // All fonts share the SAME size so the heading never shifts/reflows
  const FONTS = [
    { family: '"Playfair Display", Georgia, serif', style: 'italic', weight: 700 },
    { family: '"Merriweather", Georgia, serif', style: 'normal', weight: 700 },
    { family: '"Lora", Georgia, serif', style: 'italic', weight: 700 },
    { family: '"Libre Baskerville", Georgia, serif', style: 'normal', weight: 700 },
    { family: '"PT Serif", Georgia, serif', style: 'italic', weight: 700 },
  ]

  // groupFonts[g] = current font index for group g
  const [groupFonts, setGroupFonts] = useState(() => [
    Math.floor(Math.random() * FONTS.length),
    Math.floor(Math.random() * FONTS.length),
    Math.floor(Math.random() * FONTS.length),
  ])
  const [activeColorIdx, setActiveColorIdx] = useState(0)

  // Wave animation effect: Group 0 -> Group 1 -> Group 2 -> Group 1 -> repeat
  useEffect(() => {
    if (showSplash) {
      setSearchParams({})
    }
    const sequence = [0, 1, 2, 1]
    let stepIndex = 0

    const timer = setInterval(() => {
      const activeGroup = sequence[stepIndex]
      setGroupFonts(prev => {
        const next = [...prev]
        const currentFont = prev[activeGroup] ?? 0
        let pick
        do {
          pick = Math.floor(Math.random() * FONTS.length)
        } while (pick === currentFont)
        next[activeGroup] = pick
        return next
      })

      if (activeGroup === 2) {
        setActiveColorIdx(prev => {
          let pickColor
          do {
            pickColor = Math.floor(Math.random() * COLORS.length)
          } while (pickColor === prev)
          return pickColor
        })
      }

      stepIndex = (stepIndex + 1) % sequence.length
    }, 180) // Fast, snappy wave step time

    setIsReady(true)
    return () => clearInterval(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Map a word index to its group's current font
  const fontForWord = (wordIdx) => {
    const g = GROUPS.findIndex(grp => grp.includes(wordIdx))
    return FONTS[groupFonts[g] ?? 0]
  }

  const WORDS = FULL_TEXT.split(' ')

  const renderHeading = () => {
    if (!isReady) return null

    // Determine the active color from the state variable
    const activeColor = COLORS[activeColorIdx]

    const renderWord = (word, wordIdx, isLast) => {
      const isBlue = wordIdx >= 4          // "sign in here"
      const font = fontForWord(wordIdx)

      return (
        <span
          key={wordIdx}
          className={`transition-all duration-100 ${isBlue ? activeColor.textClass : 'text-white'}`}
          style={{ fontFamily: font.family, fontStyle: font.style, fontWeight: font.weight }}
        >
          {word}{!isLast && ' '}
        </span>
      )
    }

    // Line 1: "Ready to start"  |  Line 2: "working? sign in here"
    const line1 = WORDS.slice(0, 3)
    const line2 = WORDS.slice(3)

    return (
      <>
        <span className="inline-block">{line1.map((w, i) => renderWord(w, i, i === line1.length - 1))}</span>
        <br />
        <span className="inline-block whitespace-nowrap">
          {renderWord(line2[0], 3, false)}
          <span className="relative inline-block pb-3">
            {line2.slice(1).map((w, i) => renderWord(w, 4 + i, i === line2.length - 2))}
            <span className="absolute left-0 bottom-[-2px] w-full h-[12px] pointer-events-none overflow-visible">
              <svg viewBox="0 0 100 12" preserveAspectRatio="none" className="w-full h-full fill-none transition-all duration-300" stroke={activeColor.hex} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 2,6 C 15,1 25,11 38,3 C 50,13 62,1 75,9 C 85,3 92,11 98,5" />
                <path d="M 4,9 C 16,4 28,13 42,6 C 52,13 65,4 78,11 C 86,7 93,12 97,8" opacity="0.8" />
              </svg>
            </span>
          </span>
        </span>
      </>
    )
  }

  const handleRoleSelect = (role) => {
    setSearchParams({ role })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await login(email, password)
      if (result.success) {
        const userRole = result.user?.role?.toLowerCase()

        // Check if role matches selected role
        if (selectedRole === 'admin' && userRole !== 'admin') {
          setError('This account is not an admin account')
          setIsLoading(false)
          return
        }

        // Navigate to dashboard for admin login path, orders for user login path
        const destination = selectedRole === 'admin' ? '/dashboard' : '/orders'
        navigate(destination, { state: { fromLogin: true } })
      } else {
        // Check for pending approval error
        if (result.error?.includes('pending admin approval')) {
          navigate('/pending-approval', { state: { email } })
        } else {
          setError(result.error || 'Invalid email or password')
        }
      }
    } catch (err) {
      setError('Invalid email or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900 p-4">
      {/* Splash screen – renders via portal at document.body, slides up when done */}
      {showSplash && (
        <SplashPage
          onStartLeaving={() => setSlideLoginUp(true)}
          onComplete={() => setShowSplash(false)}
        />
      )}

      {/* Main content – starts invisible below, slides up in sync with splash */}
      <div
        className="w-full max-w-xl text-center"
        style={{
          transform:  (slideLoginUp || !showSplash) ? 'translateY(0)'   : 'translateY(60px)',
          opacity:    (slideLoginUp || !showSplash) ? 1                 : 0,
          transition: 'transform 0.8s cubic-bezier(0.77,0,0.175,1), opacity 0.8s cubic-bezier(0.77,0,0.175,1)',
        }}
      >
        {/* Font-cycling heading — fixed height prevents layout shift */}
        <h1
          className="text-4xl md:text-5xl leading-[1.25] mb-8 text-white"
          style={{ letterSpacing: '-0.01em', minHeight: '7.5rem' }}
        >
          {renderHeading()}
        </h1>

        {/* Content area */}
        {isReady && (
          <div className="space-y-6 animate-fadeIn">
            {/* Privacy policy text */}
            <p className="text-xs text-gray-400">
              By continuing, you agree to our <a href="#" className="underline hover:text-gray-300">privacy policy</a>.
            </p>

            {/* Role selection buttons */}
            {!selectedRole && (
              <div className="space-y-3">
                {/* Sign in as Admin button */}
                <button
                  onClick={() => handleRoleSelect('admin')}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-white/5 active:translate-y-0 transition-all duration-200"
                >
                  <Shield size={20} />
                  <span>Sign in as admin</span>
                </button>

                {/* Sign in as User button */}
                <button
                  onClick={() => handleRoleSelect('viewer')}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-800 text-gray-300 rounded-lg font-medium hover:bg-white hover:text-gray-900 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-white/5 active:translate-y-0 transition-all duration-200"
                >
                  <User size={20} />
                  <span>Sign in as user</span>
                </button>

                {/* OR Divider */}
                <div className="relative py-4 my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-zinc-900 px-3 text-zinc-500 font-medium tracking-widest">OR</span>
                  </div>
                </div>

                {/* New User / Sign Up Button */}
                <button
                  onClick={() => navigate('/signup')}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-white/5 active:translate-y-0 transition-all duration-200"
                >
                  <UserPlus size={20} />
                  <span>New user? <span className="underline">Sign up</span></span>
                </button>
              </div>
            )}

            {/* Email section - appears after role selection */}
            {selectedRole && (
              <div className="space-y-4 animate-fadeIn">
                {/* Divider */}
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-600"></div>
                  </div>
                </div>

                {/* Email input */}
                <form onSubmit={handleLogin} className="space-y-4">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-600 transition-all"
                    required
                  />

                  {/* Password input */}
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-600 transition-all pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-lg text-sm flex items-start gap-2.5">
                      <span className="text-red-400 font-bold shrink-0 mt-0.5">⚠️</span>
                      <p className="font-medium leading-relaxed text-left">{error}</p>
                    </div>
                  )}

                  {/* Continue with email button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Signing in...' : 'Continue with email'}
                  </button>
                </form>

                {/* Single sign-on text */}
                <p className="text-xs text-gray-500">Single sign-on (SSO)</p>

                {/* Back button */}
                <button
                  onClick={() => setSearchParams({})}
                  className="text-xs text-gray-400 hover:text-gray-300 underline"
                >
                  Back to role selection
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-600">Powered by Diversay Solutions @2025</p>
        </div>
      </div>
    </div>
  )
}
