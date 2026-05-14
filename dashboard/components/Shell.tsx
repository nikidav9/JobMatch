'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const SESSION_KEY = 'jm_session'

function getAuthed() {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'ok' | 'no'>('loading')

  // Re-check auth every time path changes (e.g. after login → redirect to /)
  useEffect(() => {
    if (path === '/login') {
      setState('loading') // reset so next nav rechecks
      return
    }
    const ok = getAuthed()
    if (ok) {
      setState('ok')
    } else {
      setState('no')
      router.replace('/login')
    }
  }, [path, router])

  // Login page — render without shell, no auth check
  if (path === '/login') return <>{children}</>

  // Warm cream bg while checking (no white flash)
  if (state !== 'ok') {
    return <div style={{ minHeight: '100vh', background: '#FAFAF7' }} />
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'var(--sidebar-w) 1fr', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar />
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
