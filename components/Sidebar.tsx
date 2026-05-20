'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, CheckCircle2, ChevronDown, ChevronRight,
  FileText, History, Link2, Plus, Presentation,
  RotateCcw, Trash2, UploadCloud, Video, XCircle,
} from 'lucide-react'
import { CountdownTimer } from './CountdownTimer'
import { cloneLink, makeLink, validateLinkInput, getStore } from '@/lib/links-store'
import type { ShowLink } from '@/types'

const MAX_UPLOAD_MB = 50
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
const ACCEPT = '.pdf,.ppt,.pptx,.mp4,.webm,.mov,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,video/mp4,video/webm,video/quicktime'

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

// ── Link form ────────────────────────────────────────────────────────────────

interface LinkFormProps {
  classCode: string
  onAdd: (link: ShowLink) => Promise<void>
  onClose: () => void
}

function LinkForm({ onAdd, onClose }: LinkFormProps) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const check = validateLinkInput(url)
    if (!check.ok) { setError(check.reason); return }
    setBusy(true)
    try {
      await onAdd(makeLink(title, url, check.kind))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-[10px] text-gray-500 leading-snug">
        Paste an external URL (e.g. OneDrive embed link, Google Slides).
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
  )
}

// ── Upload form ──────────────────────────────────────────────────────────────

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

interface UploadFormProps {
  classCode: string
  onAdd: (link: ShowLink) => Promise<void>
  onClose: () => void
}

function UploadForm({ classCode, onAdd, onClose }: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [sizeError, setSizeError] = useState(false)

  const pickFile = useCallback((f: File) => {
    setSizeError(false)
    setStatus('idle')
    setStatusMsg('')
    if (f.size > MAX_UPLOAD_BYTES) { setSizeError(true); setFile(null); return }
    const ext = f.name.toLowerCase()
    if (!ext.endsWith('.pdf') && !ext.endsWith('.pptx') && !ext.endsWith('.ppt') &&
        !ext.endsWith('.mp4') && !ext.endsWith('.webm') && !ext.endsWith('.mov')) {
      setStatusMsg('Only PDF, PPTX, and video files (MP4, WebM) are supported.')
      setStatus('error')
      setFile(null)
      return
    }
    setFile(f)
  }, [])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) pickFile(f)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) pickFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setStatus('uploading')
    setStatusMsg('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('classCode', classCode)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.status === 413) { setSizeError(true); setFile(null); setStatus('idle'); return }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Upload failed (${res.status})`)
      }
      const { existed, link } = await res.json()
      await onAdd(link)
      setStatus('done')
      setStatusMsg(existed ? 'Already in library — linked!' : 'Uploaded and added!')
      setTimeout(onClose, 1800)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  if (sizeError) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 space-y-1.5">
          <p className="text-xs font-medium text-amber-300">File too large for direct upload</p>
          <p className="text-[11px] text-amber-500 leading-snug">
            Files over {MAX_UPLOAD_MB} MB must be hosted externally. For videos, use a direct .mp4/.webm URL via the <strong className="text-amber-400">Link</strong> tab. For slides, use an OneDrive embed link.
          </p>
        </div>
        <button
          onClick={() => setSizeError(false)}
          className="w-full py-1.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
        >
          Try another file
        </button>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 py-3 px-2 text-green-400 text-sm">
        <CheckCircle2 size={16} className="shrink-0" />
        {statusMsg}
      </div>
    )
  }

  if (status === 'uploading') {
    return (
      <div className="flex items-center gap-2.5 py-3 px-2 text-gray-400 text-sm">
        <svg className="animate-spin shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Uploading {file?.name}…
      </div>
    )
  }

  if (file) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-lg bg-gray-900 border border-gray-700 px-3 py-2">
          {file.name.toLowerCase().endsWith('.pdf')
            ? <FileText size={14} className="text-red-400 shrink-0" />
            : /\.(mp4|webm|mov)$/i.test(file.name)
              ? <Video size={14} className="text-blue-400 shrink-0" />
              : <Presentation size={14} className="text-orange-400 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-200 truncate">{file.name}</p>
            <p className="text-[10px] text-gray-500">{fmtSize(file.size)}</p>
          </div>
          <button onClick={() => setFile(null)} className="text-gray-500 hover:text-gray-300">
            <XCircle size={14} />
          </button>
        </div>
        {status === 'error' && <p className="text-xs text-red-400">{statusMsg}</p>}
        <button
          onClick={handleUpload}
          className="w-full py-1.5 text-sm rounded bg-gray-100 text-gray-900 font-medium hover:bg-white"
        >
          Upload
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onInputChange} />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-1.5 py-5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
          dragOver ? 'border-gray-500 bg-gray-800/60' : 'border-gray-700 hover:border-gray-600 hover:bg-gray-900/50'
        }`}
      >
        <UploadCloud size={20} className="text-gray-500" />
        <p className="text-xs text-gray-400">Click or drag a file here</p>
        <p className="text-[10px] text-gray-600">PDF, PPTX, or video (MP4/WebM) · max {MAX_UPLOAD_MB} MB</p>
      </div>
      {status === 'error' && <p className="text-xs text-red-400">{statusMsg}</p>}
    </div>
  )
}

// ── Library panel ────────────────────────────────────────────────────────────

interface LibraryPanelProps {
  classCode: string
  onAdd: (link: ShowLink) => Promise<void>
  onClose: () => void
}

function LibraryPanel({ classCode, onAdd, onClose }: LibraryPanelProps) {
  const [library, setLibrary] = useState<ShowLink[]>([])
  const [hidden, setHidden] = useState<ShowLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getStore(classCode).listLibrary()
      .then(data => { setLibrary(data.library); setHidden(data.hidden) })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false))
  }, [classCode])

  async function handleRestore(link: ShowLink) {
    setBusy(link.id)
    try {
      await getStore(classCode).restore(link.id)
      setHidden(prev => prev.filter(l => l.id !== link.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleAdd(link: ShowLink) {
    setBusy(link.id)
    try {
      await onAdd(cloneLink(link))
      setLibrary(prev => prev.filter(l => l.id !== link.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="text-xs text-gray-500 py-2">Loading library…</p>

  const isEmpty = hidden.length === 0 && library.length === 0

  function LinkIcon({ kind }: { kind: ShowLink['kind'] }) {
    if (kind === 'pdf') return <FileText size={13} className="text-red-400 shrink-0" />
    if (kind === 'video') return <Video size={13} className="text-blue-400 shrink-0" />
    return <Presentation size={13} className="text-orange-400 shrink-0" />
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}
      {isEmpty && (
        <p className="text-xs text-gray-600 italic py-1">No links available in library.</p>
      )}

      {hidden.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5">Recently removed</p>
          <ul className="space-y-1">
            {hidden.map(link => (
              <li key={link.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-900">
                <LinkIcon kind={link.kind} />
                <span className="flex-1 min-w-0 text-xs text-gray-300 truncate">{link.title}</span>
                <button
                  onClick={() => handleRestore(link)}
                  disabled={busy === link.id}
                  className="p-1 rounded text-gray-500 hover:text-emerald-400 hover:bg-gray-800 disabled:opacity-30"
                  title="Restore to this class"
                >
                  <RotateCcw size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {library.length > 0 && (
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5">From other classes</p>
          <ul className="space-y-1">
            {library.map(link => (
              <li key={link.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-900">
                <LinkIcon kind={link.kind} />
                <span className="flex-1 min-w-0 text-xs text-gray-300 truncate">{link.title}</span>
                <button
                  onClick={() => handleAdd(link)}
                  disabled={busy === link.id}
                  className="p-1 rounded text-gray-500 hover:text-sky-400 hover:bg-gray-800 disabled:opacity-30"
                  title="Add to this class"
                >
                  <Plus size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
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
  const [addMode, setAddMode] = useState<'link' | 'upload' | 'library'>('link')

  function closeAdd() { setAdding(false) }

  function toggleFiles() {
    setFilesOpen(o => {
      if (o && adding) setAdding(false) // close add form when collapsing
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
        {/* Files header row — click chevron or label to toggle */}
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
              <div className="px-4 pb-3 space-y-3">
                <div className="flex rounded-lg bg-gray-900 p-0.5 border border-gray-800">
                  <button
                    onClick={() => setAddMode('link')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      addMode === 'link' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <Link2 size={12} /> Link
                  </button>
                  <button
                    onClick={() => setAddMode('upload')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      addMode === 'upload' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <UploadCloud size={12} /> Upload
                  </button>
                  <button
                    onClick={() => setAddMode('library')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      addMode === 'library' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <History size={12} /> Library
                  </button>
                </div>
                {addMode === 'link' ? (
                  <LinkForm classCode={classCode} onAdd={onAdd} onClose={closeAdd} />
                ) : addMode === 'upload' ? (
                  <UploadForm classCode={classCode} onAdd={onAdd} onClose={closeAdd} />
                ) : (
                  <LibraryPanel classCode={classCode} onAdd={onAdd} onClose={closeAdd} />
                )}
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
