'use client'

import dynamic from 'next/dynamic'
import { useRef, useState, useEffect } from 'react'
import {
  AlertTriangle, ChevronDown, ExternalLink, FileText, Maximize2, Menu, Minimize2,
  Plus, Presentation, Trash2, Video, X,
} from 'lucide-react'
import { getEmbedStrategy } from '@/lib/embed'
import { AddDocPanel } from './AddDocPanel'
import type { ShowLink } from '@/types'

const PdfViewer = dynamic(() => import('./PdfViewer').then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
      Loading viewer…
    </div>
  ),
})

interface ViewerProps {
  classCode: string
  links: ShowLink[]
  openTabIds: string[]
  activeTabId: string | null
  onToggleSidebar: () => void
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onAdd: (link: ShowLink) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onRefresh: () => Promise<void>
}

function fileIcon(kind: ShowLink['kind'], size = 15) {
  if (kind === 'pdf') return <FileText size={size} className="text-rose-400 shrink-0" />
  if (kind === 'video') return <Video size={size} className="text-blue-400 shrink-0" />
  return <Presentation size={size} className="text-amber-500 shrink-0" />
}

export function Viewer({ classCode, links, openTabIds, activeTabId, onToggleSidebar, onActivate, onClose, onAdd, onRemove, onRefresh }: ViewerProps) {
  const [filesOpen, setFilesOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const filesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!filesOpen) return
    function onDocClick(e: MouseEvent) {
      if (filesRef.current && !filesRef.current.contains(e.target as Node)) setFilesOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [filesOpen])

  function selectFile(id: string) {
    onActivate(id)
    setFilesOpen(false)
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900 min-w-0 overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-stretch bg-gray-950 border-b border-gray-800/80 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-3 text-gray-400 hover:text-white md:hidden border-r border-gray-800 shrink-0"
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>

        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 text-slate-400 hover:text-white hover:bg-gray-900/60 border-r border-gray-800 shrink-0 smooth-transition"
          title="添加文件"
        >
          <Plus size={15} />
        </button>

        <div ref={filesRef} className="relative shrink-0 border-r border-gray-800">
          <button
            onClick={() => setFilesOpen(v => !v)}
            className={`flex items-center gap-1.5 px-3 h-full text-sm font-medium smooth-transition ${
              filesOpen ? 'text-white bg-gray-900/60' : 'text-slate-400 hover:text-white hover:bg-gray-900/60'
            }`}
          >
            <span>选择文件</span>
            <span className="text-[10px] text-slate-500 font-mono">({links.length})</span>
            <ChevronDown size={13} className={`transition-transform ${filesOpen ? 'rotate-180' : ''}`} />
          </button>

          {filesOpen && (
            <div className="absolute left-0 top-full mt-1 w-72 max-h-96 overflow-y-auto rounded-xl border border-gray-800 bg-gray-950 shadow-2xl z-50 py-1.5">
              {links.length === 0 ? (
                <p className="px-4 py-6 text-xs text-gray-500 italic text-center">暂无文件，点击左侧「+」添加。</p>
              ) : (
                links.map(link => {
                  const active = link.id === activeTabId
                  return (
                    <div
                      key={link.id}
                      onClick={() => selectFile(link.id)}
                      className={`group flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-lg cursor-pointer smooth-transition ${
                        active ? 'bg-emerald-600/15 text-white' : 'text-slate-300 hover:bg-gray-900/70 hover:text-white'
                      }`}
                    >
                      {fileIcon(link.kind, 14)}
                      <span className="flex-1 min-w-0 text-xs font-medium truncate">{link.title}</span>
                      <button
                        onClick={e => { e.stopPropagation(); onRemove(link.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-900/80 smooth-transition shrink-0"
                        aria-label="Remove"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        <div className="flex items-end overflow-x-auto scroll-hint-right flex-1 min-w-0">
          {openTabIds.map(id => {
            const link = links.find(l => l.id === id)
            if (!link) return null
            const active = id === activeTabId
            return (
              <button
                key={id}
                onClick={() => onActivate(id)}
                className={`group flex items-center gap-2 px-4 py-3 border-r border-gray-800 shrink-0 max-w-[180px] min-w-0 transition-all smooth-transition ${
                  active
                    ? 'bg-gray-900 text-white border-b-2 border-b-emerald-500 -mb-px font-semibold'
                    : 'text-slate-500 hover:text-slate-350 hover:bg-gray-900/40'
                }`}
              >
                {fileIcon(link.kind, 13)}
                <span className="text-xs truncate flex-1 text-left">{link.title}</span>
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); onClose(id) }}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded hover:bg-gray-800 text-slate-500 hover:text-slate-300 shrink-0 ml-1.5 smooth-transition"
                  aria-label="Close tab"
                >
                  <X size={10} />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Viewer content */}
      {openTabIds.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-950/40 border border-amber-900/30 flex items-center justify-center">
            <Presentation size={24} className="text-amber-500" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-white">选择或添加文件开始演示</h2>
            <p className="text-xs text-slate-500">使用上方「选择文件」查看已上传的文档，或点击「+」添加新文件</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold active:scale-[0.98] transition-all duration-200"
            >
              <Plus size={13} /> <span>添加文件</span>
            </button>
            {links.length > 0 && (
              <button
                onClick={() => setFilesOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 text-slate-200 text-xs font-semibold hover:bg-gray-750 active:scale-[0.98] transition-all duration-200"
              >
                <ChevronDown size={13} /> <span>选择文件</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 relative min-h-0">
          {openTabIds.map(id => {
            const link = links.find(l => l.id === id)
            if (!link) return null
            const active = id === activeTabId
            return (
              <div
                key={id}
                className="absolute inset-0 flex flex-col"
                style={{ display: active ? 'flex' : 'none' }}
              >
                <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-950 shrink-0">
                  <h2 className="flex-1 text-sm font-medium text-white truncate">{link.title}</h2>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-white"
                    title="Open source URL"
                  >
                    <ExternalLink size={14} />
                  </a>
                </header>
                <div className="flex-1 min-h-0 relative">
                  {link.kind === 'pdf' ? (
                    <PdfViewer url={link.url} r2Key={link.r2Key} />
                  ) : link.kind === 'video' ? (
                    <VideoViewer link={link} />
                  ) : (
                    <PptxViewer link={link} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Document Modal Dialog */}
      {adding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-opacity duration-300">
          <div className="w-full max-w-md rounded-2xl glass-panel shadow-2xl border border-gray-800/80 overflow-hidden flex flex-col scale-100 transition-transform duration-300">
            <div className="px-5 py-4 border-b border-gray-800/60 flex items-center justify-between bg-slate-950/60">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus size={18} className="text-emerald-400" />
                <span>添加共修文件</span>
              </h3>
              <button
                onClick={() => setAdding(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-gray-900 smooth-transition"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[75vh]">
              <AddDocPanel classCode={classCode} onAdd={onAdd} onClose={() => setAdding(false)} onRefresh={onRefresh} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VideoViewer({ link }: { link: ShowLink }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <video
        src={link.url}
        controls
        className="max-w-full max-h-full"
      >
        Your browser does not support this video format.
      </video>
    </div>
  )
}

const OFFICE_ONLINE_MAX_BYTES = 50 * 1024 * 1024

function PptxViewer({ link }: { link: ShowLink }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const strategy = getEmbedStrategy(link)

  const tooLarge =
    link.size != null && link.size > OFFICE_ONLINE_MAX_BYTES && strategy.kind === 'office-online'

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen()
  }

  if (tooLarge) {
    const mb = Math.round((link.size ?? 0) / (1024 * 1024))
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="max-w-lg text-center space-y-4">
          <AlertTriangle size={32} className="mx-auto text-amber-400" />
          <h3 className="text-lg font-semibold text-white">File too large to preview</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            This PowerPoint is {mb} MB. Office Online Viewer caps around 50 MB.
            Download it, or upload a smaller version (compress media or split slides).
          </p>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-100 text-gray-900 text-sm font-medium hover:bg-white"
          >
            <ExternalLink size={14} /> Download
          </a>
        </div>
      </div>
    )
  }

  if (strategy.kind === 'blocked') {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <div className="max-w-lg text-center space-y-4">
          <AlertTriangle size={32} className="mx-auto text-amber-400" />
          <h3 className="text-lg font-semibold text-white">Can&apos;t embed this URL</h3>
          <p className="text-sm text-gray-400 leading-relaxed">{strategy.reason}</p>
          <div className="text-left text-xs text-gray-500 bg-gray-950 border border-gray-800 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-gray-300">How to get an embeddable URL:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>In OneDrive, open the file</li>
              <li>Click <span className="text-gray-300">Share → Embed</span></li>
              <li>Copy only the <code className="text-gray-300">src=&quot;…&quot;</code> URL from the iframe snippet</li>
              <li>Paste it here as a new link</li>
            </ol>
          </div>
          <a
            href={strategy.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-100 text-gray-900 text-sm font-medium hover:bg-white"
          >
            <ExternalLink size={14} /> Open in new tab
          </a>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-900">
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 z-10 bg-gray-900">
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-sm">Loading presentation…</p>
          <p className="text-xs text-gray-600">Large files may take a moment</p>
        </div>
      )}
      <iframe
        src={strategy.url}
        title={link.title}
        className="w-full h-full border-0"
        allow="fullscreen; clipboard-read; clipboard-write"
        allowFullScreen
        onLoad={() => setLoaded(true)}
      />
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-4 right-4 p-2 rounded-full bg-gray-950/90 backdrop-blur border border-gray-800 text-gray-300 hover:text-white"
        aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  )
}
