'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { isAuthed } from './AuthGuard'

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (path === '/login') {
      setReady(true)
      return
    }
    if (!isAuthed()) {
      router.replace('/login')
    } else {
      setReady(true)
    }
  }, [path, router])

  if (!ready) return null

  // Login page: no shell
  if (path === '/login') return <>{children}</>

  // Dashboard: full shell with sidebar + topbar
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
