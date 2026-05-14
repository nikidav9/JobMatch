interface Props {
  label: string
  value: string | number
  sub?: string
  trend?: number        // % change
  color?: string
  icon?: string
}

export default function KpiCard({ label, value, sub, trend, color = '#FF6B1A', icon }: Props) {
  const trendUp = (trend ?? 0) >= 0
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex flex-col gap-2 min-w-0">
      <div className="flex items-start justify-between">
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide leading-tight">{label}</p>
        {icon && <span className="text-lg opacity-60">{icon}</span>}
      </div>
      <p className="text-3xl font-extrabold" style={{ color }}>{value}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {sub && <p className="text-slate-400 text-xs">{sub}</p>}
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
            trendUp ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}>
            {trendUp ? '↑' : '↓'}{Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  )
}
