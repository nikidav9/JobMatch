import type { Metadata } from 'next'
import './globals.css'
import Shell from '@/components/Shell'

export const metadata: Metadata = {
  title: 'JobMatch — Аналитика',
  description: 'Аналитический дашборд JobMatch',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  )
}
