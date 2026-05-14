'use client'
import { useCallback } from 'react'
import { fetchMatching, PALETTE } from '@/lib/queries'
import { useRealtime } from '@/lib/useRealtime'
import KpiCard from '@/components/KpiCard'
import ChartCard from '@/components/ChartCard'
import LiveBadge from '@/components/LiveBadge'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export default function MatchingPage() {
  const fetcher = useCallback(() => fetchMatching(), [])
  const { data: d, loading, lastUpdated, pulse, refresh } = useRealtime(fetcher, {
    tables: ['jm_likes'],
    intervalSec: 30,
  })

  if (loading || !d) return <Loader />

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Совпадения</h1>
          <p className="text-sm text-slate-400 mt-0.5">Realtime · обновление каждые 30 сек</p>
        </div>
        <LiveBadge lastUpdated={lastUpdated} pulse={pulse} onRefresh={refresh} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        <KpiCard icon="❤️" label="Лайков" value={d.kpi.totalLikes} color={PALETTE.pink} />
        <KpiCard icon="↩️" label="Скипов" value={d.kpi.skipped} color={PALETTE.gray} />
        <KpiCard icon="🤝" label="Совпадений" value={d.kpi.totalMatches} color={PALETTE.purple} />
        <KpiCard icon="📊" label="Конверсия" value={`${d.kpi.matchRate}%`} color={PALETTE.purple} />
        <KpiCard icon="✅" label="Подтверждено" value={d.kpi.confirmed} color={PALETTE.orange} />
        <KpiCard icon="📈" label="% подтверждения" value={`${d.kpi.confirmRate}%`} color={PALETTE.orange} />
        <KpiCard icon="🏁" label="Завершено смен" value={d.kpi.completed} color={PALETTE.green} />
        <KpiCard icon="🎯" label="% завершения" value={`${d.kpi.completionRate}%`} color={PALETTE.green} />
      </div>

      <ChartCard title="Лайки и совпадения по дням" sub="30 дней">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={d.daily30} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gLk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PALETTE.pink} stopOpacity={0.25} /><stop offset="95%" stopColor={PALETTE.pink} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gMt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PALETTE.purple} stopOpacity={0.35} /><stop offset="95%" stopColor={PALETTE.purple} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={3} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="likes" name="Лайки" stroke={PALETTE.pink} fill="url(#gLk)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="matches" name="Совпадения" stroke={PALETTE.purple} fill="url(#gMt)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Воронка совпадений" sub="От лайка до завершения смены">
          <div className="space-y-3 py-2">
            {d.funnel.map((item, i) => {
              const maxVal = d.funnel[0].value
              const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0
              const convPct = i > 0 && d.funnel[i - 1].value > 0
                ? ((item.value / d.funnel[i - 1].value) * 100).toFixed(0) : null
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-28 shrink-0 font-medium">{item.name}</span>
                  <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden">
                    <div className="h-full rounded-lg flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: item.fill }}>
                      <span className="text-white text-xs font-bold">{item.value.toLocaleString('ru')}</span>
                    </div>
                  </div>
                  {convPct && <span className="text-xs text-slate-400 w-12 text-right shrink-0">→{convPct}%</span>}
                </div>
              )
            })}
          </div>
        </ChartCard>

        <ChartCard title="Конверсия по типам работ" sub="Лайки → Совпадения">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.matchByWorkType} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }}
                formatter={(value: any, name: string) => [name === 'rate' ? `${value}%` : value, name === 'rate' ? 'Конверсия %' : name === 'likes' ? 'Лайки' : 'Совпадения']} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="likes" name="Лайки" fill={PALETTE.pink} opacity={0.6} radius={[4, 4, 0, 0]} />
              <Bar dataKey="matches" name="Совпадения" fill={PALETTE.purple} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="% конверсии по типам работ" sub="Доля лайков, ставших совпадениями">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={d.matchByWorkType} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} width={80} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} formatter={(v: any) => [`${v}%`, 'Конверсия']} />
            <Bar dataKey="rate" name="Конверсия %" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#64748B', formatter: (v: any) => `${v}%` }}>
              {d.matchByWorkType.map((e, i) => <Cell key={i} fill={e.rate > 50 ? PALETTE.green : e.rate > 25 ? PALETTE.amber : PALETTE.red} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

function Loader() {
  return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />)}</div>
}
