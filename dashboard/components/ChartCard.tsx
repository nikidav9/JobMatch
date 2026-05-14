interface Props {
  title: string
  sub?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export default function ChartCard({ title, sub, children, className = '', action }: Props) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
