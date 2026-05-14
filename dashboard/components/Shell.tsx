'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { isAuthed } from './AuthGuard'

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  // null = still checking, true/false = result
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const ok = isAuthed()
    setAuthed(ok)
    if (!ok && path !== '/login') {
      router.replace('/login')
    }
  }, []) // only on mount

  // Login page — always show immediately, no auth check needed
  if (path === '/login') {
    return <>{children}</>
  }

  // Still checking — show warm background (no white flash)
  if (authed === null) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />
  }

  // Not authed — redirect in progress
  if (!authed) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />
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
