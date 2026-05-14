'use client'
import { useEffect, useState } from 'react'
import { fetchEngagement, PALETTE } from '@/lib/queries'
import KpiCard from '@/components/KpiCard'
import ChartCard from '@/components/ChartCard'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

export default function EngagementPage() {
  const [d, setD] = useState<Awaited<ReturnType<typeof fetchEngagement>> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchEngagement().then(r => { setD(r); setLoading(false) }) }, [])

  if (loading || !d) return <Loader />

  return (
    <div className="p-6 space-y-6">
      <Header title="Активность" onRefresh={() => { setLoading(true); fetchEngagement().then(r => { setD(r); setLoading(false) }) }} />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon="💬" label="Всего чатов" value={d.kpi.totalChats} color={PALETTE.cyan} />
        <KpiCard icon="✉️" label="Сообщений" value={d.kpi.totalMessages} color={PALETTE.blue} />
        <KpiCard icon="📊" label="Ср. сообщ./чат" value={d.kpi.avgMsgPerChat} color={PALETTE.purple} />
        <KpiCard icon="🆕" label="Чатов за 7 дней" value={d.kpi.activeChats} color={PALETTE.green} />
        <KpiCard icon="🔔" label="Непрочит. (рабочие)" value={d.kpi.unreadWorker} color={PALETTE.orange} />
        <KpiCard icon="🔔" label="Непрочит. (работод.)" value={d.kpi.unreadEmployer} color={PALETTE.blue} />
      </div>

      {/* Messages + chats area */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Сообщения по дням" sub="90 дней">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.daily90} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gMsg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.blue} stopOpacity={0.3} /><stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={8} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Area type="monotone" dataKey="messages" name="Сообщения" stroke={PALETTE.blue} fill="url(#gMsg)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Новые чаты по дням" sub="90 дней">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.daily90} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gCht" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.cyan} stopOpacity={0.3} /><stop offset="95%" stopColor={PALETTE.cyan} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={8} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Area type="monotone" dataKey="chats" name="Чаты" stroke={PALETTE.cyan} fill="url(#gCht)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Msg distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Распределение сообщений в чатах" sub="Сколько сообщений в каждом чате">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.msgDist} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Bar dataKey="value" name="Чатов" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11, fill: '#64748B' }}>
                {d.msgDist.map((_, i) => <Cell key={i} fill={Object.values(PALETTE)[i % 8]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Combined messages+chats last 30 */}
        <ChartCard title="Сообщения и чаты" sub="Последние 30 дней — комбинированный">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.daily90.slice(-30)} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gMsg2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.blue} stopOpacity={0.3} /><stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gCht2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.cyan} stopOpacity={0.3} /><stop offset="95%" stopColor={PALETTE.cyan} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="messages" name="Сообщения" stroke={PALETTE.blue} fill="url(#gMsg2)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="chats" name="Чаты" stroke={PALETTE.cyan} fill="url(#gCht2)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

function Loader() {
  return <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />)}</div>
}

function Header({ title, onRefresh }: { title: string; onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
      <button onClick={onRefresh} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition shadow-sm">↺ Обновить</button>
    </div>
  )
}
