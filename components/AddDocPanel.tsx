'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CheckCircle2, FileText, History, Link2,
  Plus, Presentation, RotateCcw, UploadCloud, Video, XCircle,
} from 'lucide-react'
import { cloneLink, getStore, makeLink, validateLinkInput } from '@/lib/links-store'
import type { ShowLink } from '@/types'

const MAX_UPLOAD_MB = 500
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
const ACCEPT = '.pdf,.ppt,.pptx,.mp4,.webm,.mov,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,video/mp4,video/webm,video/quicktime'

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function LinkIcon({ kind }: { kind: ShowLink['kind'] }) {
  if (kind === 'pdf') return <FileText size={14} className="text-rose-400 shrink-0" />
  if (kind === 'video') return <Video size={14} className="text-blue-400 shrink-0" />
  return <Presentation size={14} className="text-amber-500 shrink-0" />
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
    <form onSubmit={handleSubmit} className="space-y-3.5 mt-2">
      <p className="text-xs text-slate-400 leading-snug">
        输入第三方云盘（如 OneDrive 嵌入链接、Google Slides 链接等）或直接文件地址。
      </p>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="文件标题（选填，默认解析文件名）"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all smooth-transition"
        />
        <input
          type="url"
          placeholder="https://邀请链接或嵌入链接"
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all smooth-transition"
        />
      </div>
      {error && (
        <p className="text-xs text-rose-400 bg-rose-950/20 py-1.5 px-3 rounded-lg border border-rose-900/30">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200"
      >
        {busy ? '正在添加...' : '确认添加'}
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
  const [progress, setProgress] = useState(0)

  const pickFile = useCallback((f: File) => {
    setSizeError(false)
    setStatus('idle')
    setStatusMsg('')
    if (f.size > MAX_UPLOAD_BYTES) { setSizeError(true); setFile(null); return }
    const ext = f.name.toLowerCase()
    if (!ext.endsWith('.pdf') && !ext.endsWith('.pptx') && !ext.endsWith('.ppt') &&
        !ext.endsWith('.mp4') && !ext.endsWith('.webm') && !ext.endsWith('.mov')) {
      setStatusMsg('仅支持 PDF、PPTX、PPT 演示文稿及 MP4、WebM、MOV 视频。')
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

  function putWithProgress(url: string, body: File, contentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 105))
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`上传失败 (${xhr.status})`))
      }
      xhr.onerror = () => reject(new Error('上传出错'))
      xhr.send(body)
    })
  }

  const handleUpload = async () => {
    if (!file) return
    setStatus('uploading')
    setStatusMsg('')
    setProgress(0)
    try {
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classCode, filename: file.name, size: file.size, contentType: file.type }),
      })
      if (presignRes.status === 413) { setSizeError(true); setFile(null); setStatus('idle'); return }
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => ({}))
        throw new Error(data.error || `请求失败 (${presignRes.status})`)
      }
      const { existed, uploadUrl, contentType, link } = await presignRes.json()

      if (!existed) {
        await putWithProgress(uploadUrl, file, contentType)
      }

      await onAdd(link)
      setStatus('done')
      setStatusMsg(existed ? '文件已存在 - 已直接关联！' : '文件上传成功并已添加！')
      setTimeout(onClose, 1800)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : '上传失败')
    }
  }

  if (sizeError) {
    return (
      <div className="space-y-3 mt-2">
        <div className="rounded-2xl border border-amber-900 bg-amber-950/20 p-4 space-y-2">
          <p className="text-xs font-bold text-amber-300">文件大小超出限制</p>
          <p className="text-[11px] text-amber-500 leading-relaxed">
            目前最大上传限制为 {MAX_UPLOAD_MB} MB。如需播放大型视频，建议使用 **链接** 模式添加直链。幻灯片可直接使用 OneDrive 嵌入分享。
          </p>
        </div>
        <button
          onClick={() => setSizeError(false)}
          className="w-full py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 smooth-transition text-xs font-semibold"
        >
          重新选择文件
        </button>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-2 text-emerald-400 gap-2">
        <CheckCircle2 size={32} className="shrink-0 animate-bounce" />
        <span className="text-sm font-medium">{statusMsg}</span>
      </div>
    )
  }

  if (status === 'uploading') {
    return (
      <div className="space-y-3.5 py-4 px-2">
        <div className="flex items-center justify-between text-slate-300 text-xs">
          <div className="flex items-center gap-2">
            <svg className="animate-spin shrink-0 h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="truncate max-w-[240px] font-medium">正在上传 {file?.name}</span>
          </div>
          <span className="font-mono text-[11px] font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded">
            {progress}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-900 p-[1px]">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>
    )
  }

  if (file) {
    return (
      <div className="space-y-3.5 mt-2">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-950/80 border border-slate-800 px-4 py-3">
          {file.name.toLowerCase().endsWith('.pdf')
            ? <FileText size={18} className="text-rose-400 shrink-0" />
            : /\.(mp4|webm|mov)$/i.test(file.name)
              ? <Video size={18} className="text-blue-400 shrink-0" />
              : <Presentation size={18} className="text-amber-550 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate leading-snug">{file.name}</p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{fmtSize(file.size)}</p>
          </div>
          <button 
            onClick={() => setFile(null)} 
            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-900 smooth-transition"
            aria-label="Remove selection"
          >
            <XCircle size={16} />
          </button>
        </div>
        {status === 'error' && (
          <p className="text-xs text-rose-400 bg-rose-950/20 py-1.5 px-3 rounded-lg border border-rose-900/30">
            {statusMsg}
          </p>
        )}
        <button
          onClick={handleUpload}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold active:scale-[0.98] transition-all duration-200"
        >
          开始上传
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3.5 mt-2">
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onInputChange} />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-2.5 py-8 rounded-2xl border-2 border-dashed cursor-pointer smooth-transition ${
          dragOver 
            ? 'border-emerald-500 bg-emerald-950/20 scale-[0.99]' 
            : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/40'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
          <UploadCloud size={22} className="smooth-transition" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold text-slate-300">点击或拖拽文件到这里</p>
          <p className="text-[10px] text-slate-500">支持 PDF、PPT(X) 及视频 (MP4/WebM) · 最大 {MAX_UPLOAD_MB} MB</p>
        </div>
      </div>
      {status === 'error' && (
        <p className="text-xs text-rose-400 bg-rose-950/20 py-1.5 px-3 rounded-lg border border-rose-900/30">
          {statusMsg}
        </p>
      )}
    </div>
  )
}

// ── Library panel ─────────────────────────────────────────────────────────────

function LibraryPanel({ classCode, onAdd, onRefresh }: { classCode: string; onAdd: (link: ShowLink) => Promise<void>; onRefresh?: () => Promise<void> }) {
  const [library, setLibrary] = useState<ShowLink[]>([])
  const [hidden, setHidden] = useState<ShowLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getStore(classCode).listLibrary()
      .then(data => { setLibrary(data.library); setHidden(data.hidden) })
      .catch(e => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [classCode])

  async function handleRestore(link: ShowLink) {
    setBusy(link.id)
    try {
      await getStore(classCode).restore(link.id)
      setHidden(prev => prev.filter(l => l.id !== link.id))
      await onRefresh?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '恢复失败')
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
      setError(e instanceof Error ? e.message : '引入失败')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-500 text-xs gap-2">
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>正在载入公共库...</span>
      </div>
    )
  }

  const isEmpty = hidden.length === 0 && library.length === 0

  return (
    <div className="space-y-4 mt-2">
      {error && (
        <p className="text-xs text-rose-400 bg-rose-950/20 py-1.5 px-3 rounded-lg border border-rose-900/30">
          {error}
        </p>
      )}
      
      {isEmpty && (
        <p className="text-xs text-slate-500 italic text-center py-4">共享库中没有可用文件。</p>
      )}

      {hidden.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-1">最近隐藏文件</p>
          <ul className="space-y-1">
            {hidden.map(link => (
              <li key={link.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-900">
                <div className="flex items-center gap-2 min-w-0">
                  <LinkIcon kind={link.kind} />
                  <span className="text-xs text-slate-200 truncate max-w-[260px] font-medium">{link.title}</span>
                </div>
                <button
                  onClick={() => handleRestore(link)}
                  disabled={busy === link.id}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-900 disabled:opacity-30 smooth-transition"
                  title="恢复到本班级"
                >
                  <RotateCcw size={13} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {library.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-1">其他班级共享</p>
          <ul className="space-y-1">
            {library.map(link => (
              <li key={link.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-900">
                <div className="flex items-center gap-2 min-w-0">
                  <LinkIcon kind={link.kind} />
                  <span className="text-xs text-slate-200 truncate max-w-[260px] font-medium">{link.title}</span>
                </div>
                <button
                  onClick={() => handleAddFromLibrary(link)}
                  disabled={busy === link.id}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-slate-900 disabled:opacity-30 smooth-transition"
                  title="添加到本班级"
                >
                  <Plus size={13} />
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
  onRefresh?: () => Promise<void>
}

export function AddDocPanel({ classCode, onAdd, onClose, onRefresh }: AddDocPanelProps) {
  const [mode, setMode] = useState<'link' | 'upload' | 'library'>('link')

  return (
    <div className="space-y-4">
      {/* Premium Tab Switcher */}
      <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-900">
        <button
          onClick={() => setMode('link')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
            mode === 'link' 
              ? 'bg-slate-800 text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Link2 size={13} />
          <span>添加链接</span>
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
            mode === 'upload' 
              ? 'bg-slate-800 text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <UploadCloud size={13} />
          <span>上传文件</span>
        </button>
        <button
          onClick={() => setMode('library')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
            mode === 'library' 
              ? 'bg-slate-800 text-white shadow-sm' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <History size={13} />
          <span>从共享库</span>
        </button>
      </div>
      
      <div className="smooth-transition">
        {mode === 'link' && <LinkForm onAdd={onAdd} onClose={onClose} />}
        {mode === 'upload' && <UploadForm classCode={classCode} onAdd={onAdd} onClose={onClose} />}
        {mode === 'library' && <LibraryPanel classCode={classCode} onAdd={onAdd} onRefresh={onRefresh} />}
      </div>
    </div>
  )
}
