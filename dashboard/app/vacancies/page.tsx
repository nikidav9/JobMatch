'use client'
import { useCallback } from 'react'
import { fetchVacancies, PALETTE } from '@/lib/queries'
import { useRealtime } from '@/lib/useRealtime'
import KpiCard from '@/components/KpiCard'
import ChartCard from '@/components/ChartCard'
import LiveBadge from '@/components/LiveBadge'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export default function VacanciesPage() {
  const fetcher = useCallback(() => fetchVacancies(), [])
  const { data: d, loading, lastUpdated, pulse, refresh } = useRealtime(fetcher, {
    tables: ['jm_vacancies', 'jm_perm_vacancies'],
    intervalSec: 30,
  })

  if (loading || !d) return <Loader />

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Вакансии</h1>
          <p className="text-sm text-slate-400 mt-0.5">Realtime · обновление каждые 30 сек</p>
        </div>
        <LiveBadge lastUpdated={lastUpdated} pulse={pulse} onRefresh={refresh} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        <KpiCard icon="⚡" label="Врем. вакансий" value={d.kpi.totalTemp} color={PALETTE.orange} />
        <KpiCard icon="💼" label="Пост. вакансий" value={d.kpi.totalPerm} color={PALETTE.blue} />
        <KpiCard icon="✅" label="Открыто (врем.)" value={d.kpi.openTemp} color={PALETTE.green} />
        <KpiCard icon="✅" label="Открыто (пост.)" value={d.kpi.openPerm} color={PALETTE.green} />
        <KpiCard icon="🔒" label="Закрыто (врем.)" value={d.kpi.closedTemp} color={PALETTE.gray} />
        <KpiCard icon="🔒" label="Закрыто (пост.)" value={d.kpi.closedPerm} color={PALETTE.gray} />
        <KpiCard icon="🚨" label="Срочных" value={d.kpi.urgentTemp} color={PALETTE.red} />
        <KpiCard icon="📅" label="Новых за месяц" value={d.kpi.newMonth} color={PALETTE.purple} />
      </div>

      <ChartCard title="Публикация вакансий" sub="Временные и постоянные по дням (90 дней)">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={d.daily90} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PALETTE.orange} stopOpacity={0.3} /><stop offset="95%" stopColor={PALETTE.orange} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PALETTE.blue} stopOpacity={0.3} /><stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={8} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="temp" name="Временные" stroke={PALETTE.orange} fill="url(#gT)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="perm" name="Постоянные" stroke={PALETTE.blue} fill="url(#gP)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard title="Типы работ" sub="Временные вакансии">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d.workTypeDist} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} width={80} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Bar dataKey="value" name="Вакансий" radius={[0, 4, 4, 0]}>
                {d.workTypeDist.map((_, i) => <Cell key={i} fill={Object.values(PALETTE)[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Статус (врем.)" sub="Открыто / закрыто">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={d.tempStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={68} dataKey="value" paddingAngle={4}>
                {d.tempStatus.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6">
            <div className="text-center"><p className="text-xl font-bold" style={{ color: PALETTE.green }}>{d.kpi.openTemp}</p><p className="text-xs text-slate-400">Открыто</p></div>
            <div className="text-center"><p className="text-xl font-bold" style={{ color: PALETTE.gray }}>{d.kpi.closedTemp}</p><p className="text-xs text-slate-400">Закрыто</p></div>
          </div>
        </ChartCard>

        <ChartCard title="Статус (пост.)" sub="Открыто / закрыто">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={d.permStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={68} dataKey="value" paddingAngle={4}>
                {d.permStatus.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6">
            <div className="text-center"><p className="text-xl font-bold" style={{ color: PALETTE.green }}>{d.kpi.openPerm}</p><p className="text-xs text-slate-400">Открыто</p></div>
            <div className="text-center"><p className="text-xl font-bold" style={{ color: PALETTE.gray }}>{d.kpi.closedPerm}</p><p className="text-xs text-slate-400">Закрыто</p></div>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Зарплатные диапазоны" sub="Постоянные вакансии">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d.salaryDist} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Bar dataKey="value" name="Вакансий" radius={[4, 4, 0, 0]}>
                {d.salaryDist.map((_, i) => <Cell key={i} fill={PALETTE.blue} opacity={0.6 + i * 0.08} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Топ работодателей" sub="По количеству вакансий">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Компания', 'Смены', 'Пост.', 'Всего'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {d.topEmployers.map((e, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-2 pr-4 font-medium text-slate-700 text-sm">{e.name}</td>
                    <td className="py-2 pr-4 text-slate-500">{e.temp}</td>
                    <td className="py-2 pr-4 text-slate-500">{e.perm}</td>
                    <td className="py-2 font-bold" style={{ color: PALETTE.orange }}>{e.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

function Loader() {
  return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />)}</div>
}
