import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { login } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      setServerError('')
      const res = await login(data.email, data.password)
      setAuth(res.user, res.token)
      navigate('/projects')
    } catch {
      setServerError('Invalid email or password. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-navy-900 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950" />
        <div className="absolute top-0 left-0 w-full h-full opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #6EE7B7 0%, transparent 50%), radial-gradient(circle at 80% 20%, #FDE68A 0%, transparent 40%)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Aurum" className="w-10 h-10" />
            <div>
              <p className="text-white font-semibold text-lg leading-none">Aurum</p>
              <p className="text-brand-green text-xs font-medium mt-0.5">Project Controls</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            NEC Contract<br />
            <span className="text-gradient-brand">Intelligence Engine</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Digitise Early Warnings, Risk Registers, Compensation Events and commercial reporting — built exclusively for NEC3 and NEC4 contracts.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { label: 'Early Warnings', desc: 'NEC cl. 15' },
              { label: 'Risk Register', desc: 'Live exposure' },
              { label: 'Comp. Events', desc: 'Full workflow' },
              { label: 'Audit Trail', desc: 'Every action' },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-white text-sm font-medium">{label}</p>
                <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-slate-600 text-xs">
          © {new Date().getFullYear()} Aurum Project Controls. All rights reserved.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <img src="/logo.svg" alt="Aurum" className="w-9 h-9" />
            <p className="font-semibold text-navy-900 text-lg">Aurum Project Controls</p>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                placeholder="you@company.com"
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green ${errors.email ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className={`w-full px-3.5 py-2.5 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-brand-green/40 focus:border-brand-green ${errors.password ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                {...register('password')}
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            {serverError && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                <p className="text-sm text-red-600">{serverError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-navy-900 gradient-brand hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed shadow-sm mt-2"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-xs text-slate-400 text-center">
            Protected by enterprise-grade security
          </p>
        </div>
      </div>
    </div>
  )
}
