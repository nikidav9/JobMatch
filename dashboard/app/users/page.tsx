'use client'
import { useCallback } from 'react'
import { fetchUsers, PALETTE } from '@/lib/queries'
import { useRealtime } from '@/lib/useRealtime'
import KpiCard from '@/components/KpiCard'
import ChartCard from '@/components/ChartCard'
import LiveBadge from '@/components/LiveBadge'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export default function UsersPage() {
  const fetcher = useCallback(() => fetchUsers(), [])
  const { data: d, loading, lastUpdated, pulse, refresh } = useRealtime(fetcher, {
    tables: ['jm_users'],
    intervalSec: 30,
  })

  if (loading || !d) return <Loader />

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Пользователи</h1>
          <p className="text-sm text-slate-400 mt-0.5">Realtime · обновление каждые 30 сек</p>
        </div>
        <LiveBadge lastUpdated={lastUpdated} pulse={pulse} onRefresh={refresh} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon="👥" label="Всего" value={d.kpi.total} color={PALETTE.orange} />
        <KpiCard icon="👷" label="Работники" value={d.kpi.workers} sub={`${d.kpi.workerPct}%`} color={PALETTE.orange} />
        <KpiCard icon="🏢" label="Работодатели" value={d.kpi.employers} sub={`${100 - Number(d.kpi.workerPct)}%`} color={PALETTE.blue} />
        <KpiCard icon="🚫" label="Заблокировано" value={d.kpi.blocked} color={PALETTE.red} />
        <KpiCard icon="🆕" label="Новых за 7 дней" value={d.kpi.newWeek} color={PALETTE.green} />
        <KpiCard icon="📅" label="Новых за 30 дней" value={d.kpi.newMonth} color={PALETTE.green} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Новые регистрации" sub="Работники vs работодатели (90 дней)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.growth90} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gW2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.orange} stopOpacity={0.3} /><stop offset="95%" stopColor={PALETTE.orange} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gE2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.blue} stopOpacity={0.3} /><stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={8} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="workers" name="Работники" stroke={PALETTE.orange} fill="url(#gW2)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="employers" name="Работодатели" stroke={PALETTE.blue} fill="url(#gE2)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Накопительный рост" sub="Общее число пользователей (90 дней)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.cumulative} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.purple} stopOpacity={0.3} /><stop offset="95%" stopColor={PALETTE.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={8} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="total" name="Всего" stroke={PALETTE.purple} fill="url(#gTotal)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="workers" name="Работники" stroke={PALETTE.orange} fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              <Area type="monotone" dataKey="employers" name="Работодатели" stroke={PALETTE.blue} fill="none" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard title="Топ станций метро" sub="Работники и работодатели" className="md:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.metroTop} layout="vertical" margin={{ left: 8, right: 16, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="station" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} width={110} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="workers" name="Работники" fill={PALETTE.orange} stackId="a" />
              <Bar dataKey="employers" name="Работодатели" fill={PALETTE.blue} stackId="a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Соотношение ролей">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={d.roleSplit} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={4}>
                {d.roleSplit.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center">
            <div className="text-center"><p className="text-lg font-bold" style={{ color: PALETTE.orange }}>{d.kpi.workerPct}%</p><p className="text-xs text-slate-400">Работники</p></div>
            <div className="text-center"><p className="text-lg font-bold" style={{ color: PALETTE.blue }}>{100 - Number(d.kpi.workerPct)}%</p><p className="text-xs text-slate-400">Работодатели</p></div>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Последние регистрации" sub="20 новых пользователей">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                {['Имя', 'Телефон', 'Роль', 'Метро', 'Дата'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-3 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {d.recent.map((u, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-slate-700">{u.name || '—'}</td>
                  <td className="py-2.5 pr-4 text-slate-500 font-mono text-xs">{u.phone}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'worker' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                      {u.role === 'worker' ? 'Работник' : 'Работодатель'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-500 text-xs">{u.metro}</td>
                  <td className="py-2.5 text-slate-400 text-xs">{u.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}

function Loader() {
  return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />)}</div>
}
