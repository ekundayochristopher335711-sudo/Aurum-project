export default function LogoSpinner({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="animate-spin"
      style={{ animationDuration: '1s' }}
    >
      <defs>
        <linearGradient id="spinGrad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#6EE7B7" />
          <stop offset="100%" stopColor="#FDE68A" />
        </linearGradient>
      </defs>
      <polygon
        points="50,6 88,27 88,73 50,94 12,73 12,27"
        fill="none"
        stroke="url(#spinGrad)"
        strokeWidth="9"
        strokeLinejoin="round"
        strokeDasharray="240"
        strokeDashoffset="60"
      />
    </svg>
  )
}

export function PageLoader() {
  return (
    <div className="fixed inset-0 bg-navy-900 flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center gap-5">
        <svg width="56" height="56" viewBox="0 0 100 100" className="animate-spin" style={{ animationDuration: '1.2s' }}>
          <defs>
            <linearGradient id="loaderGrad" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="#6EE7B7" />
              <stop offset="55%" stopColor="#BEF5DC" />
              <stop offset="100%" stopColor="#FDE68A" />
            </linearGradient>
          </defs>
          <polygon
            points="50,6 88,27 88,73 50,94 12,73 12,27"
            fill="none"
            stroke="url(#loaderGrad)"
            strokeWidth="9"
            strokeLinejoin="round"
            strokeDasharray="240"
            strokeDashoffset="80"
          />
          <rect x="26" y="37" width="48" height="34" rx="2" fill="none" stroke="white" strokeWidth="4.5" opacity="0.3" />
          <polyline points="26,40 50,60 74,40" fill="none" stroke="white" strokeWidth="4.5" opacity="0.3" />
        </svg>
        <div className="text-center">
          <p className="text-white font-semibold text-base">Aurum Project Controls</p>
          <p className="text-slate-500 text-xs mt-1">Loading…</p>
        </div>
      </div>
    </div>
  )
}
