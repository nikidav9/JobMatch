'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const SESSION_KEY = 'jm_session'

export function setAuth() {
  sessionStorage.setItem(SESSION_KEY, '1')
}

export function clearAuth() {
  sessionStorage.removeItem(SESSION_KEY)
}

export function isAuthed() {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const path = usePathname()
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

  if (!ready && path !== '/login') return null
  return <>{children}</>
}
