'use client'
import { useCallback } from 'react'
import { fetchQuality, PALETTE } from '@/lib/queries'
import { useRealtime } from '@/lib/useRealtime'
import KpiCard from '@/components/KpiCard'
import ChartCard from '@/components/ChartCard'
import LiveBadge from '@/components/LiveBadge'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

export default function QualityPage() {
  const fetcher = useCallback(() => fetchQuality(), [])
  const { data: d, loading, lastUpdated, pulse, refresh } = useRealtime(fetcher, {
    tables: ['jm_ratings', 'jm_complaints', 'jm_perm_applications'],
    intervalSec: 60,
  })

  if (loading || !d) return <Loader />

  const ratingNum = Number(d.kpi.avgRating)
  const ratingColor = ratingNum >= 4 ? PALETTE.green : ratingNum >= 3 ? PALETTE.amber : PALETTE.red

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Качество</h1>
          <p className="text-sm text-slate-400 mt-0.5">Realtime · обновление каждые 60 сек</p>
        </div>
        <LiveBadge lastUpdated={lastUpdated} pulse={pulse} onRefresh={refresh} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard icon="⭐" label="Средний рейтинг" value={d.kpi.avgRating} color={ratingColor} sub="Все оценки" />
        <KpiCard icon="👷" label="Рейтинг работников" value={d.kpi.avgWorkerRating} color={PALETTE.orange} />
        <KpiCard icon="🏢" label="Рейтинг работодат." value={d.kpi.avgEmployerRating} color={PALETTE.blue} />
        <KpiCard icon="📝" label="Всего оценок" value={d.kpi.totalRatings} color={PALETTE.purple} />
        <KpiCard icon="🚨" label="Жалоб всего" value={d.kpi.totalComplaints} color={PALETTE.red} sub={`${d.kpi.workerComplaints} рабочих · ${d.kpi.employerComplaints} работодат.`} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <KpiCard icon="📋" label="Заявок (пост.)" value={d.kpi.totalApplications} color={PALETTE.cyan} />
        <KpiCard icon="⏳" label="Ожидает" value={d.kpi.pendingApplications} color={PALETTE.amber} />
        <KpiCard icon="✅" label="Одобрено" value={d.appStatus.find(a => a.name === 'Одобрено')?.value ?? 0} color={PALETTE.green} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Распределение оценок" sub="Работники и работодатели">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.ratingDist} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 14, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="workers" name="Работники" fill={PALETTE.orange} stackId="a" />
              <Bar dataKey="employers" name="Работодатели" fill={PALETTE.blue} stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Средний рейтинг по дням" sub="30 дней">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={d.ratingTrend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} formatter={(v: any) => [v ? Number(v).toFixed(2) : '—', 'Рейтинг']} />
              <ReferenceLine y={4} stroke={PALETTE.green} strokeDasharray="4 2" label={{ value: '4.0', fill: PALETTE.green, fontSize: 11 }} />
              <ReferenceLine y={3} stroke={PALETTE.amber} strokeDasharray="4 2" label={{ value: '3.0', fill: PALETTE.amber, fontSize: 11 }} />
              <Line type="monotone" dataKey="avg" name="Ср. рейтинг" stroke={ratingColor} strokeWidth={2.5} dot={{ r: 3, fill: ratingColor }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard title="Жалобы" sub="По типу">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={d.complaintSplit} cx="50%" cy="50%" innerRadius={48} outerRadius={70} dataKey="value" paddingAngle={4}>
                {d.complaintSplit.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4">
            <div className="text-center"><p className="text-xl font-bold" style={{ color: PALETTE.orange }}>{d.kpi.workerComplaints}</p><p className="text-xs text-slate-400">На работников</p></div>
            <div className="text-center"><p className="text-xl font-bold" style={{ color: PALETTE.blue }}>{d.kpi.employerComplaints}</p><p className="text-xs text-slate-400">На работодателей</p></div>
          </div>
        </ChartCard>

        <ChartCard title="Жалобы по дням" sub="30 дней">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.complaintTrend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Bar dataKey="count" name="Жалобы" fill={PALETTE.red} opacity={0.8} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Заявки (пост. вакансии)" sub="По статусу">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={d.appStatus} cx="50%" cy="50%" innerRadius={48} outerRadius={70} dataKey="value" paddingAngle={4}>
                {d.appStatus.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 flex-wrap">
            {d.appStatus.map(a => (
              <div key={a.name} className="text-center">
                <p className="text-lg font-bold" style={{ color: a.fill }}>{a.value}</p>
                <p className="text-xs text-slate-400">{a.name}</p>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {d.recentComplaints.length > 0 && (
        <ChartCard title="Последние жалобы" sub={`${d.kpi.totalComplaints} всего`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Тип', 'От кого', 'На кого', 'Описание', 'Дата'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {d.recentComplaints.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.type === 'worker' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                        {c.type === 'worker' ? '👷 Работник' : '🏢 Работодат.'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500 font-mono text-xs">{c.reporter}</td>
                    <td className="py-2.5 pr-4 text-slate-500 font-mono text-xs">{c.target}</td>
                    <td className="py-2.5 pr-4 text-slate-600 text-xs max-w-xs truncate">{c.desc}</td>
                    <td className="py-2.5 text-slate-400 text-xs">{c.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  )
}

function Loader() {
  return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />)}</div>
}
