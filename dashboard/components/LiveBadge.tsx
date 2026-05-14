interface Props {
  lastUpdated: string
  pulse: boolean
  onRefresh: () => void
}

export default function LiveBadge({ lastUpdated, pulse, onRefresh }: Props) {
  return (
    <div className="flex items-center gap-3">
      {lastUpdated && (
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full transition-all ${pulse ? 'bg-green-400 scale-125' : 'bg-green-500'}`} />
          <span className="text-xs text-slate-400">обновлено {lastUpdated}</span>
        </div>
      )}
      <button
        onClick={onRefresh}
        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition shadow-sm"
      >
        ↺ Обновить
      </button>
    </div>
  )
}
