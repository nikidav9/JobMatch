'use client'
import { useEffect, useState } from 'react'
import { fetchOverview, PALETTE } from '@/lib/queries'
import KpiCard from '@/components/KpiCard'
import ChartCard from '@/components/ChartCard'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export default function OverviewPage() {
  const [d, setD] = useState<Awaited<ReturnType<typeof fetchOverview>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState('')

  useEffect(() => {
    fetchOverview().then(r => {
      setD(r)
      setLoading(false)
      setUpdated(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
    })
  }, [])

  if (loading || !d) return <PageLoader />

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Обзор" sub={`Обновлено в ${updated}`} onRefresh={() => { setLoading(true); fetchOverview().then(r => { setD(r); setLoading(false) }) }} />

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon="👥" label="Всего пользователей" value={d.kpi.totalUsers} sub={`+${d.kpi.newUsersWeek} за 7 дней`} trend={d.kpi.trendUsers} color={PALETTE.orange} />
        <KpiCard icon="👷" label="Работники" value={d.kpi.workers} sub={`${Math.round(d.kpi.workers / Math.max(d.kpi.totalUsers, 1) * 100)}%`} color={PALETTE.orange} />
        <KpiCard icon="🏢" label="Работодатели" value={d.kpi.employers} color={PALETTE.blue} />
        <KpiCard icon="⚡" label="Врем. вакансии" value={d.kpi.tempVacancies} sub={`${d.kpi.openTemp} открыто`} color={PALETTE.green} />
        <KpiCard icon="💼" label="Пост. вакансии" value={d.kpi.permVacancies} sub={`${d.kpi.openPerm} открыто`} color={PALETTE.green} />
        <KpiCard icon="💬" label="Чатов" value={d.kpi.chats} sub={`${d.kpi.messages} сообщений`} color={PALETTE.cyan} />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard icon="❤️" label="Лайков" value={d.kpi.totalLikes} color={PALETTE.pink} />
        <KpiCard icon="🤝" label="Совпадений" value={d.kpi.totalMatches} sub={`+${d.kpi.newMatchesMonth} за 30 дней`} trend={d.kpi.trendMatches} color={PALETTE.purple} />
        <KpiCard icon="📊" label="Конверсия в матч" value={`${d.kpi.matchRate}%`} color={PALETTE.purple} />
        <KpiCard icon="✅" label="Подтверждено" value={d.kpi.confirmed} color={PALETTE.green} />
        <KpiCard icon="⭐" label="Средний рейтинг" value={d.kpi.avgRating} color={PALETTE.amber} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Регистрации по дням" sub="Работники и работодатели (30 дней)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.dailyUsers} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gW" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.orange} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PALETTE.orange} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.blue} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,.08)', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="workers" name="Работники" stroke={PALETTE.orange} fill="url(#gW)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="employers" name="Работодатели" stroke={PALETTE.blue} fill="url(#gE)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Вакансии и совпадения" sub="Новые записи по дням (30 дней)">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.dailyVacs} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PALETTE.green} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gM" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.purple} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PALETTE.purple} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="vacancies" name="Вакансии" stroke={PALETTE.green} fill="url(#gV)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="matches" name="Совпадения" stroke={PALETTE.purple} fill="url(#gM)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard title="Воронка" sub="От просмотра до завершения смены">
          <div className="space-y-2">
            {d.funnel.map((item, i) => {
              const maxVal = d.funnel[0].value
              const pct = maxVal > 0 ? (item.value / maxVal) * 100 : 0
              return (
                <div key={item.name}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-600 font-medium">{item.name}</span>
                    <span className="text-xs font-bold text-slate-700">{item.value.toLocaleString('ru')}</span>
                  </div>
                  <div className="h-6 bg-slate-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center pl-2 transition-all"
                      style={{
                        width: `${Math.max(pct, 4)}%`,
                        backgroundColor: [PALETTE.blue, PALETTE.cyan, PALETTE.purple, PALETTE.orange, PALETTE.green][i],
                        opacity: 0.85,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </ChartCard>

        <ChartCard title="Типы работ" sub="Временные вакансии">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d.workTypeDist} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} width={70} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Bar dataKey="value" name="Вакансий" radius={[0, 4, 4, 0]}>
                {d.workTypeDist.map((_, i) => <Cell key={i} fill={Object.values(PALETTE)[i % 8]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Пользователи" sub="Соотношение">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={[
                { name: 'Работники', value: d.kpi.workers, fill: PALETTE.orange },
                { name: 'Работодатели', value: d.kpi.employers, fill: PALETTE.blue },
              ]} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                {[PALETTE.orange, PALETTE.blue].map((c, i) => <Cell key={i} fill={c} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function PageLoader() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-10 w-48 bg-slate-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}

function PageHeader({ title, sub, onRefresh }: { title: string; sub?: string; onRefresh?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {sub && <p className="text-sm text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {onRefresh && (
        <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition shadow-sm">
          ↺ Обновить
        </button>
      )}
    </div>
  )
}
