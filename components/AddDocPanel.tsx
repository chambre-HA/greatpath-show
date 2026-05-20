'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CheckCircle2, FileText, History, Link2,
  Plus, Presentation, RotateCcw, UploadCloud, Video, XCircle,
} from 'lucide-react'
import { cloneLink, getStore, makeLink, validateLinkInput } from '@/lib/links-store'
import type { ShowLink } from '@/types'

const MAX_UPLOAD_MB = 50
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
const ACCEPT = '.pdf,.ppt,.pptx,.mp4,.webm,.mov,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,video/mp4,video/webm,video/quicktime'

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function LinkIcon({ kind }: { kind: ShowLink['kind'] }) {
  if (kind === 'pdf') return <FileText size={13} className="text-red-400 shrink-0" />
  if (kind === 'video') return <Video size={13} className="text-blue-400 shrink-0" />
  return <Presentation size={13} className="text-orange-400 shrink-0" />
}

// ── Link form ─────────────────────────────────────────────────────────────────

function LinkForm({ onAdd, onClose }: { onAdd: (link: ShowLink) => Promise<void>; onClose: () => void }) {
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

// ── Upload form ───────────────────────────────────────────────────────────────

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

function UploadForm({ classCode, onAdd, onClose }: { classCode: string; onAdd: (link: ShowLink) => Promise<void>; onClose: () => void }) {
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

// ── Library panel ─────────────────────────────────────────────────────────────

function LibraryPanel({ classCode, onAdd }: { classCode: string; onAdd: (link: ShowLink) => Promise<void> }) {
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

  async function handleAddFromLibrary(link: ShowLink) {
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
                  onClick={() => handleAddFromLibrary(link)}
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

// ── AddDocPanel ───────────────────────────────────────────────────────────────

interface AddDocPanelProps {
  classCode: string
  onAdd: (link: ShowLink) => Promise<void>
  onClose: () => void
}

export function AddDocPanel({ classCode, onAdd, onClose }: AddDocPanelProps) {
  const [mode, setMode] = useState<'link' | 'upload' | 'library'>('link')

  return (
    <div className="space-y-3">
      <div className="flex rounded-lg bg-gray-900 p-0.5 border border-gray-800">
        <button
          onClick={() => setMode('link')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
            mode === 'link' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Link2 size={12} /> Link
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
            mode === 'upload' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <UploadCloud size={12} /> Upload
        </button>
        <button
          onClick={() => setMode('library')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${
            mode === 'library' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <History size={12} /> Library
        </button>
      </div>
      {mode === 'link' && <LinkForm onAdd={onAdd} onClose={onClose} />}
      {mode === 'upload' && <UploadForm classCode={classCode} onAdd={onAdd} onClose={onClose} />}
      {mode === 'library' && <LibraryPanel classCode={classCode} onAdd={onAdd} />}
    </div>
  )
}
