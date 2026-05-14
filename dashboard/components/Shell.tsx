'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const SESSION_KEY = 'jm_session'

function isAuthed() {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const rawPath = usePathname()
  // Normalize: strip trailing slash so '/login/' === '/login'
  const path = rawPath.replace(/\/$/, '') || '/'
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    // Login page — no auth check needed
    if (path === '/login') {
      setReady(true)
      return
    }
    const ok = isAuthed()
    if (ok) {
      setAuthed(true)
      setReady(true)
    } else {
      // Full-page redirect — works reliably in static exports
      window.location.replace('/login')
    }
  }, [path])

  // Login page — render without shell
  if (path === '/login' || rawPath === '/login/') {
    return <>{children}</>
  }

  // Warm background while checking auth / redirecting
  if (!ready || !authed) {
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
