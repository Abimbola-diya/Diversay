import { useLocation, useNavigate } from 'react-router-dom'

export default function PendingApprovalPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = location.state?.email || 'your email'

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center py-8 px-4">
      {/* DIVERSAY Logo */}
      <div className="fixed top-4 left-4">
        <h1 className="text-sm font-bold text-white tracking-tight">
          DIVE<span className="spin-i">I</span>SAY
        </h1>
      </div>

      {/* Pending Approval Container */}
      <div className="w-full max-w-md">
        <div className="bg-zinc-850/80 backdrop-blur-md rounded-3xl border border-zinc-700 p-8 shadow-lg">
          {/* Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/15 rounded-full mb-4">
              <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Account Pending Approval</h2>
            <p className="text-sm text-zinc-400">
              Your account request is being reviewed by an administrator
            </p>
          </div>

          {/* Message */}
          <div className="space-y-4 mb-8">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <p className="text-sm text-zinc-300">
                <span className="font-semibold">Email:</span> {email}
              </p>
              <p className="text-xs text-zinc-400 mt-2">
                An administrator will review your request and send you an email notification once your account has been approved. This typically takes 1-2 business days.
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-400 mb-2">What happens next?</h3>
              <ul className="text-xs text-blue-300 space-y-1 list-disc list-inside">
                <li>An admin reviews your signup request</li>
                <li>You'll receive an approval or rejection email</li>
                <li>Once approved, you can log in to access the portal</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-2xl transition"
            >
              Back to Login
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="w-full px-6 py-3 bg-zinc-800 text-zinc-300 font-semibold rounded-2xl hover:bg-zinc-700 transition"
            >
              Create Different Account
            </button>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 pt-6 border-t border-zinc-700">
            <p className="text-xs text-zinc-400">
              Have questions? Contact support@diversay.com
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
