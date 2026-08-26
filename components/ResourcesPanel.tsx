'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Link2, Menu } from 'lucide-react'
import type { ResourceLink } from '@/types'

/** Groups the flat, already-ordered list into per-category buckets, preserving first-seen category order. */
function groupByCategory(items: ResourceLink[]): { category: string; items: ResourceLink[] }[] {
  const order: string[] = []
  const map = new Map<string, ResourceLink[]>()
  for (const item of items) {
    if (!map.has(item.category)) {
      map.set(item.category, [])
      order.push(item.category)
    }
    map.get(item.category)!.push(item)
  }
  return order.map(category => ({ category, items: map.get(category)! }))
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

/** Read-only view of the global 常用资源 list — editing happens in the admin panel. */
export function ResourcesPanel({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const [items, setItems] = useState<ResourceLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/resources', { cache: 'no-store' })
      if (!res.ok) throw new Error(`加载失败 (${res.status})`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const groups = groupByCategory(items)

  return (
    <div className="flex-1 flex flex-col bg-zinc-900 min-w-0 min-h-0 overflow-y-auto premium-glow-bg relative">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur px-4 py-3.5 flex items-center gap-3 shrink-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 -ml-1.5 text-zinc-400 hover:text-white md:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
        )}
        <h1 className="flex-1 text-sm font-bold text-white leading-tight">常用资源</h1>
      </header>

      <div className="max-w-2xl w-full mx-auto px-4 py-8 space-y-8 relative z-10">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm gap-2">
            <svg className="animate-spin h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>正在载入资源...</span>
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-400 bg-rose-950/20 py-2 px-4 rounded-[var(--radius-sm)] border border-rose-900/30">
            {error}
          </p>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="text-center py-16 bg-zinc-900/40 rounded-[var(--radius-md)] border border-zinc-800 p-8">
            <p className="text-zinc-400 text-sm italic">暂无常用资源。</p>
          </div>
        )}

        {!loading && !error && groups.map(group => (
          <div key={group.category} className="space-y-3">
            <h2 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 px-1">{group.category}</h2>
            <ul className="space-y-2">
              {group.items.map(item => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3.5 rounded-[var(--radius-md)] border border-zinc-800/80 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-zinc-700 smooth-transition group"
                  >
                    <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 text-orange-400">
                      <Link2 size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white smooth-transition">{item.name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono tracking-wider truncate">{hostOf(item.url)}</p>
                    </div>
                    <ExternalLink size={13} className="shrink-0 text-zinc-600 group-hover:text-orange-400 smooth-transition" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
