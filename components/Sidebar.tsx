'use client'

import { useState } from 'react'
import {
  ArrowLeft, ChevronDown, ChevronRight,
  FileText, Link2, Plus, Presentation, Trash2, Video,
} from 'lucide-react'
import { CountdownTimer } from './CountdownTimer'
import { AddDocPanel } from './AddDocPanel'
import type { ShowLink } from '@/types'

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  classCode: string
  className: string
  links: ShowLink[]
  selectedId: string | null
  isOpen: boolean
  onSelect: (id: string) => void
  onAdd: (link: ShowLink) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onBack: () => void
}

export function Sidebar({ classCode, className, links, selectedId, isOpen, onSelect, onAdd, onRemove, onBack }: SidebarProps) {
  const [filesOpen, setFilesOpen] = useState(true)
  const [adding, setAdding] = useState(false)

  function closeAdd() { setAdding(false) }

  function toggleFiles() {
    setFilesOpen(o => {
      if (o && adding) setAdding(false)
      return !o
    })
  }

  return (
    <aside className={`w-72 shrink-0 h-screen flex flex-col bg-gray-950 border-r border-gray-800 fixed md:relative z-50 transition-transform duration-300 overflow-y-auto ${
      isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            aria-label="Back"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-white leading-tight">共修平台</h1>
            <p className="text-[11px] text-gray-600 truncate">{className}</p>
          </div>
        </div>
      </div>

      {/* Files section */}
      <div className="border-b border-gray-800 shrink-0">
        <div className="px-4 py-3 flex items-center gap-1.5">
          <button
            onClick={toggleFiles}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left group"
          >
            {filesOpen
              ? <ChevronDown size={13} className="text-gray-500 shrink-0" />
              : <ChevronRight size={13} className="text-gray-500 shrink-0" />}
            <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold group-hover:text-gray-400 transition-colors">
              Files ({links.length})
            </span>
          </button>
          {filesOpen && (
            <button
              onClick={() => adding ? closeAdd() : setAdding(true)}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
              title="Add document"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {filesOpen && (
          <>
            {adding && (
              <div className="px-4 pb-3">
                <AddDocPanel classCode={classCode} onAdd={onAdd} onClose={closeAdd} />
              </div>
            )}

            <ul className="px-2 pb-2 space-y-0.5 max-h-64 overflow-y-auto">
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
                      {link.kind === 'pdf'
                        ? <FileText size={14} className="text-red-400 shrink-0" />
                        : link.kind === 'video'
                          ? <Video size={14} className="text-blue-400 shrink-0" />
                          : <Presentation size={14} className="text-orange-400 shrink-0" />}
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
          </>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Timer — pinned at bottom */}
      <div className="px-4 pt-4 pb-[50px] border-t border-gray-800 shrink-0">
        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Timer</h2>
        <CountdownTimer />
      </div>
    </aside>
  )
}
