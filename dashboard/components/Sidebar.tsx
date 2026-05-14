'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/',           icon: '📊', label: 'Обзор' },
  { href: '/users',      icon: '👥', label: 'Пользователи' },
  { href: '/vacancies',  icon: '💼', label: 'Вакансии' },
  { href: '/matching',   icon: '🤝', label: 'Совпадения' },
  { href: '/engagement', icon: '💬', label: 'Активность' },
  { href: '/quality',    icon: '⭐', label: 'Качество' },
]

export default function Sidebar() {
  const path = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-[#0F172A] flex flex-col z-50 border-r border-white/5">
      {/* logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF6B1A] flex items-center justify-center text-white font-black text-sm">J</div>
          <div>
            <p className="text-white font-bold text-sm leading-none">JobMatch</p>
            <p className="text-slate-500 text-xs mt-0.5">Аналитика</p>
          </div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, icon, label }) => {
          const active = path === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-[#FF6B1A] text-white shadow-lg shadow-orange-500/20'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-slate-600 text-xs">v1.0 · Admin only</p>
      </div>
    </aside>
  )
}
