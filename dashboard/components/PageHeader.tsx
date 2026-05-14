interface Props {
  title: string
  intervalSec: number
  lastUpdated: string
  pulse: boolean
  onRefresh: () => void
}

export default function PageHeader({ title, intervalSec, lastUpdated, pulse, onRefresh }: Props) {
  return (
    <div style={{
      padding: '20px 24px 14px',
      display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap',
      borderBottom: '1px solid var(--line)',
    }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0 }}>
          {title}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--positive)', display: 'inline-block',
              animation: 'livepulse 1.6s infinite',
            }} />
            <style>{`@keyframes livepulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
            Realtime
          </span>
          <span>·</span>
          <span>обновление каждые {intervalSec} сек</span>
          {lastUpdated && <>
            <span>·</span>
            <span className="mono">обновлено {lastUpdated}</span>
          </>}
        </div>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onRefresh}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 11px', borderRadius: 7,
            border: '1px solid var(--line)', background: 'var(--bg-elev)',
            color: 'var(--ink)', font: 'inherit', fontSize: 12.5, fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
            <path d="M13.5 8a5.5 5.5 0 1 1-2-4.2M13.5 2.5V5H11"/>
          </svg>
          Обновить
        </button>
      </div>
    </div>
  )
}
