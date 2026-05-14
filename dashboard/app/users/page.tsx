'use client'
import { useCallback } from 'react'
import { fetchUsers, PALETTE } from '@/lib/queries'
import { useRealtime } from '@/lib/useRealtime'
import KpiCard from '@/components/KpiCard'
import ChartCard from '@/components/ChartCard'
import PageHeader from '@/components/PageHeader'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const TT = { borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-elev)', color: 'var(--ink)', fontSize: 12, boxShadow: 'var(--shadow-md)' }
const AXIS = { fontSize: 10, fill: '#9A9690', fontFamily: 'Geist Mono, monospace' }

export default function UsersPage() {
  const fetcher = useCallback(() => fetchUsers(), [])
  const { data: d, loading, lastUpdated, pulse, refresh } = useRealtime(fetcher, {
    tables: ['jm_users'],
    intervalSec: 30,
  })

  if (loading || !d) return <Loader />

  const workerPct = Math.round(d.kpi.workers / Math.max(d.kpi.total, 1) * 100)

  return (
    <div>
      <PageHeader title="Пользователи" intervalSec={30} lastUpdated={lastUpdated} pulse={pulse} onRefresh={refresh} />

      <div style={{ padding: '16px 24px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          <KpiCard label="Всего" value={d.kpi.total} />
          <KpiCard label="Работники" value={d.kpi.workers} sub={`${workerPct}% базы`} sparkColor={PALETTE.orange} />
          <KpiCard label="Работодатели" value={d.kpi.employers} sub={`${100 - workerPct}% базы`} sparkColor={PALETTE.blue} />
          <KpiCard label="Заблокировано" value={d.kpi.blocked} sparkColor={PALETTE.red} />
          <KpiCard label="Новых · 7 дней" value={d.kpi.newWeek} deltaTone="pos" delta={`+${d.kpi.newWeek}`} />
          <KpiCard label="Новых · 30 дней" value={d.kpi.newMonth} deltaTone="pos" delta={`+${d.kpi.newMonth}`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
          <ChartCard title="Новые регистрации" sub="Работники vs работодатели · 90 дней">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={d.growth90} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gW2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETTE.orange} stopOpacity={0.2} /><stop offset="95%" stopColor={PALETTE.orange} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gE2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETTE.blue} stopOpacity={0.2} /><stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E6DF" vertical={false} />
                <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} interval={8} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TT} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#6B6760' }} />
                <Area type="monotone" dataKey="workers" name="Работники" stroke={PALETTE.orange} fill="url(#gW2)" strokeWidth={1.7} dot={false} />
                <Area type="monotone" dataKey="employers" name="Работодатели" stroke={PALETTE.blue} fill="url(#gE2)" strokeWidth={1.7} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Накопительный рост" sub="Общее число пользователей · 90 дней">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={d.cumulative} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETTE.purple} stopOpacity={0.2} /><stop offset="95%" stopColor={PALETTE.purple} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E6DF" vertical={false} />
                <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} interval={8} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TT} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#6B6760' }} />
                <Area type="monotone" dataKey="total" name="Всего" stroke={PALETTE.purple} fill="url(#gTotal)" strokeWidth={1.7} dot={false} />
                <Area type="monotone" dataKey="workers" name="Работники" stroke={PALETTE.orange} fill="none" strokeWidth={1.4} strokeDasharray="4 2" dot={false} />
                <Area type="monotone" dataKey="employers" name="Работодатели" stroke={PALETTE.blue} fill="none" strokeWidth={1.4} strokeDasharray="4 2" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <ChartCard title="Топ станций метро" sub="Работники и работодатели">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.metroTop.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E6DF" horizontal={false} />
                <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: '#3D3A33' }} tickLine={false} axisLine={false} width={80} />
                <Tooltip contentStyle={TT} />
                <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#6B6760' }} />
                <Bar dataKey="workers" name="Работники" fill={PALETTE.orange} stackId="a" />
                <Bar dataKey="employers" name="Работодатели" fill={PALETTE.blue} stackId="a" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Соотношение ролей" sub={`Из ${d.kpi.total} пользователей`}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={[
                  { name: 'Работники', value: d.kpi.workers },
                  { name: 'Работодатели', value: d.kpi.employers },
                ]} cx="50%" cy="50%" innerRadius={55} outerRadius={78} dataKey="value" paddingAngle={3}>
                  <Cell fill={PALETTE.orange} />
                  <Cell fill={PALETTE.blue} />
                </Pie>
                <Tooltip contentStyle={TT} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#6B6760' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ChartCard title="Заблокировано" sub="По типу">
              <div style={{ fontSize: 42, fontWeight: 500, letterSpacing: '-0.03em', color: d.kpi.blocked > 0 ? 'var(--negative)' : 'var(--positive)', lineHeight: 1, marginTop: 8 }}>
                {d.kpi.blocked}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
                {d.kpi.blocked === 0 ? 'Нет заблокированных пользователей' : 'Заблокированных пользователей'}
              </div>
            </ChartCard>
          </div>
        </div>

        {/* Recent users table */}
        {d.recent.length > 0 && (
          <ChartCard title="Последние регистрации" sub={`Сегодня · ${d.recent.length} событий`}>
            <div style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    {['Пользователь', 'Роль', 'Город', 'Станция', 'Дата'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', fontSize: 10.5, textTransform: 'uppercase',
                        letterSpacing: '0.06em', color: 'var(--ink-3)', fontWeight: 500,
                        padding: '8px 16px', borderBottom: '1px solid var(--line)',
                        background: 'var(--bg)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((u, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunken)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                            background: u.role === 'worker' ? 'linear-gradient(135deg,var(--accent),#7D2D0E)' : 'linear-gradient(135deg,var(--info),#1F3A8A)',
                            display: 'grid', placeItems: 'center',
                            color: '#fff', fontWeight: 600, fontSize: 11,
                          }}>
                            {u.phone.slice(-2)}
                          </div>
                          <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{u.phone}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '2px 7px', borderRadius: 5, fontSize: 11,
                          color: u.role === 'worker' ? 'var(--accent)' : 'var(--info)',
                          background: u.role === 'worker' ? 'var(--accent-soft)' : 'rgba(59,91,181,.08)',
                        }}>
                          {u.role === 'worker' ? 'работник' : 'работодатель'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--ink-2)' }}>{u.company || '—'}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--ink-3)' }}>{u.metro || '—'}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--ink-3)', fontFamily: 'Geist Mono, monospace', fontSize: 11.5 }}>{u.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )}
      </div>
    </div>
  )
}

function Loader() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ height: i === 0 ? 56 : 120, background: 'var(--bg-sunken)', borderRadius: 10 }} />
      ))}
    </div>
  )
}
