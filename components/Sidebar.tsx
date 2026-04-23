'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight,
  FileText, FolderOpen, Link2, Plus, Presentation,
  Timer, Trash2, UploadCloud, XCircle,
} from 'lucide-react'
import { CountdownTimer } from './CountdownTimer'
import { makeLink, validateLinkInput } from '@/lib/links-store'
import type { ShowLink } from '@/types'

const MAX_UPLOAD_MB = 50
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
const ACCEPT = '.pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'

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
    if (!ext.endsWith('.pdf') && !ext.endsWith('.pptx') && !ext.endsWith('.ppt')) {
      setStatusMsg('Only PDF and PPTX files are supported.')
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
            Files over {MAX_UPLOAD_MB} MB must be hosted on OneDrive. Upload there, then paste the embed URL via the <strong className="text-amber-400">Link</strong> tab.
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
        <p className="text-[10px] text-gray-600">PDF or PPTX · max {MAX_UPLOAD_MB} MB</p>
      </div>
      {status === 'error' && <p className="text-xs text-red-400">{statusMsg}</p>}
    </div>
  )
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

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
  const [collapsed, setCollapsed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addMode, setAddMode] = useState<'link' | 'upload'>('link')

  // Persist collapsed state
  useEffect(() => {
    const saved = window.localStorage.getItem('greatpath-show:sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])
  useEffect(() => {
    window.localStorage.setItem('greatpath-show:sidebar-collapsed', String(collapsed))
  }, [collapsed])

  function expand() { setCollapsed(false) }
  function closeAdd() { setAdding(false) }

  // ── Collapsed strip ────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 h-screen flex flex-col items-center py-3 gap-2 bg-gray-950 border-r border-gray-800">
        <button
          onClick={onBack}
          className="p-2 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>

        <button
          onClick={expand}
          className="p-2 rounded text-gray-400 hover:text-white hover:bg-gray-800"
          aria-label="Expand sidebar"
        >
          <ChevronRight size={16} />
        </button>

        <div className="w-6 h-px bg-gray-800 my-1" />

        <button
          onClick={expand}
          className="relative p-2 rounded text-gray-400 hover:text-white hover:bg-gray-800"
          aria-label={`${links.length} files`}
          title={`${links.length} file${links.length !== 1 ? 's' : ''}`}
        >
          <FolderOpen size={16} />
          {links.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center text-[9px] font-bold bg-gray-600 text-white rounded-full">
              {links.length}
            </span>
          )}
        </button>

        <div className="flex-1" />

        <button
          onClick={expand}
          className="p-2 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"
          aria-label="Timer"
          title="Timer"
        >
          <Timer size={16} />
        </button>
      </aside>
    )
  }

  // ── Expanded sidebar ───────────────────────────────────────────────────────
  return (
    <aside className="w-72 shrink-0 h-screen flex flex-col bg-gray-950 border-r border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            aria-label="Back"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white leading-tight">共修平台</h1>
            <p className="text-[11px] text-gray-600 truncate">{className}</p>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
            Files ({links.length})
          </span>
          <button
            onClick={() => adding ? closeAdd() : setAdding(true)}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
            title="Add document"
          >
            <Plus size={16} />
          </button>
        </div>

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
            </div>

            {addMode === 'link' ? (
              <LinkForm classCode={classCode} onAdd={onAdd} onClose={closeAdd} />
            ) : (
              <UploadForm classCode={classCode} onAdd={onAdd} onClose={closeAdd} />
            )}
          </div>
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
                  {link.kind === 'pdf'
                    ? <FileText size={14} className="text-red-400 shrink-0" />
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
      </div>

      <div className="px-4 pt-4 pb-10 border-t border-gray-800">
        <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Timer</h2>
        <CountdownTimer />
      </div>
    </aside>
  )
}
