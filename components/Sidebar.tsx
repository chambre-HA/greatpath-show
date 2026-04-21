'use client'

import { useState } from 'react'
import { ArrowLeft, FileText, Link2, Plus, Presentation, Trash2 } from 'lucide-react'
import { CountdownTimer } from './CountdownTimer'
import { makeLink, validateLinkInput } from '@/lib/links-store'
import type { ShowLink } from '@/types'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

interface SidebarProps {
  classCode: string
  className: string
  links: ShowLink[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: (link: ShowLink) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onBack: () => void
}

export function Sidebar({ classCode, className, links, selectedId, onSelect, onAdd, onRemove, onBack }: SidebarProps) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const check = validateLinkInput(url)
    if (!check.ok) { setError(check.reason); return }
    setBusy(true)
    try {
      await onAdd(makeLink(title, url, check.kind))
      setTitle('')
      setUrl('')
      setAdding(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add')
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="w-72 shrink-0 h-screen flex flex-col bg-gray-950 border-r border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            aria-label="Back to class selection"
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">共修平台</h1>
            <p className="text-[11px] text-gray-600 truncate">{className}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
            Files ({links.length})
          </span>
          <button
            onClick={() => setAdding(a => !a)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
            title="Add link"
          >
            <Plus size={16} />
          </button>
        </div>

        {adding && (
          <form onSubmit={handleSubmit} className="px-4 pb-3 space-y-2">
            <p className="text-[10px] text-gray-500 leading-snug">
              Add an external URL (e.g. OneDrive embed link). For large PPT files, share from OneDrive and paste the embed URL here.
            </p>
            <input
              type="text"
              placeholder="Title (optional)"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500"
            />
            <input
              type="url"
              placeholder="https://…"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              className="w-full px-2 py-1.5 text-sm rounded bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-1.5 text-sm rounded bg-gray-100 text-gray-900 font-medium hover:bg-white disabled:opacity-50"
            >
              {busy ? 'Adding…' : 'Add'}
            </button>
          </form>
        )}

        <ul className="px-2 space-y-0.5">
          {links.length === 0 && (
            <li className="px-2 py-4 text-xs text-gray-500 italic text-center">No files yet.</li>
          )}
          {links.map(link => {
            const active = link.id === selectedId
            const isExternal = !link.id.startsWith('r2:')
            const host = isExternal ? hostOf(link.url) : ''
            const sizeMb = link.size ? Math.round(link.size / (1024 * 1024)) : null
            return (
              <li key={link.id}>
                <div
                  className={`group flex items-center gap-2 px-2 py-2 rounded cursor-pointer ${
                    active ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-900'
                  }`}
                  onClick={() => onSelect(link.id)}
                >
                  {link.kind === 'pdf' ? (
                    <FileText size={14} className="text-red-400 shrink-0" />
                  ) : (
                    <Presentation size={14} className="text-orange-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{link.title}</p>
                    {(isExternal || sizeMb) && (
                      <p className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                        {isExternal ? <><Link2 size={10} /> {host}</> : <>{sizeMb} MB</>}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); onRemove(link.id) }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-500 hover:text-red-400"
                    aria-label="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="p-4 border-t border-gray-800">
        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Timer</h2>
        <CountdownTimer />
      </div>
    </aside>
  )
}
