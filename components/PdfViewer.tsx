'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
const DEFAULT_ZOOM_INDEX = 2 // 1.0

const R2_HOSTS = ['r2.cloudflarestorage.com', 'vibeuncle.com']

function resolveUrl(url: string, r2Key?: string): string {
  if (r2Key) return `/api/r2/proxy?key=${encodeURIComponent(r2Key)}`
  try {
    const { hostname, pathname } = new URL(url)
    if (R2_HOSTS.some(h => hostname.endsWith(h))) {
      const key = decodeURIComponent(pathname.replace(/^\//, ''))
      return `/api/r2/proxy?key=${encodeURIComponent(key)}`
    }
  } catch { /* not a valid URL, fall through */ }
  return url
}

interface PdfViewerProps {
  url: string
  r2Key?: string
}

export function PdfViewer({ url, r2Key }: PdfViewerProps) {
  const sourceUrl = resolveUrl(url, r2Key)
  const containerRef = useRef<HTMLDivElement>(null)
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined)
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM_INDEX)
  const [fullscreen, setFullscreen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const pageInputRef = useRef<HTMLInputElement>(null)
  const pinnedPages = useRef<Map<string, number>>(new Map())

  const zoom = ZOOM_STEPS[zoomIdx]
  const pageWidth = containerWidth ? Math.round(containerWidth * zoom) : undefined

  useEffect(() => {
    setPage(pinnedPages.current.get(url) ?? 1)
    setNumPages(0)
  }, [url])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerWidth(el.clientWidth - 48)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  useEffect(() => {
    if (editing) {
      pageInputRef.current?.select()
    }
  }, [editing])

  const goToPage = useCallback((p: number) => {
    pinnedPages.current.set(url, p)
    setPage(p)
  }, [url])

  const next = useCallback(() => goToPage(Math.min(page + 1, numPages)), [goToPage, page, numPages])
  const prev = useCallback(() => goToPage(Math.max(page - 1, 1)), [goToPage, page])
  const zoomIn = useCallback(() => setZoomIdx((i) => Math.min(i + 1, ZOOM_STEPS.length - 1)), [])
  const zoomOut = useCallback(() => setZoomIdx((i) => Math.max(i - 1, 0)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault(); next()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault(); prev()
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault(); zoomIn()
      } else if (e.key === '-') {
        e.preventDefault(); zoomOut()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, zoomIn, zoomOut])

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen()
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-900 overflow-auto">
      <div className="min-h-full flex flex-col items-center py-6 pb-20">
        <Document
          file={sourceUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<div className="text-gray-400 text-sm mt-20">Loading PDF…</div>}
          error={<div className="text-red-400 text-sm p-4 mt-20">Failed to load PDF.</div>}
        >
          <Page
            pageNumber={page}
            width={pageWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>

      <div className="sticky bottom-4 flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1 bg-gray-950/90 backdrop-blur border border-gray-800 rounded-full px-3 py-1.5">
          <button onClick={prev} disabled={page <= 1}
            className="p-1.5 text-gray-300 hover:text-white disabled:opacity-30" aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          {editing ? (
            <input
              ref={pageInputRef}
              type="text"
              inputMode="numeric"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const n = parseInt(draft, 10)
                  if (n >= 1 && n <= numPages) goToPage(n)
                  setEditing(false)
                } else if (e.key === 'Escape') {
                  setEditing(false)
                }
              }}
              onBlur={() => {
                const n = parseInt(draft, 10)
                if (n >= 1 && n <= numPages) goToPage(n)
                setEditing(false)
              }}
              className="w-10 text-center text-xs text-white bg-gray-800 border border-gray-600 rounded px-1 py-0.5 outline-none focus:border-gray-400 tabular-nums"
            />
          ) : (
            <button
              onClick={() => { setDraft(String(page)); setEditing(true) }}
              className="text-xs text-gray-300 hover:text-white tabular-nums min-w-[4rem] text-center hover:bg-gray-800 rounded px-1 py-0.5 transition-colors"
              title="Click to jump to page"
            >
              {page} / {numPages || '–'}
            </button>
          )}
          <button onClick={next} disabled={page >= numPages}
            className="p-1.5 text-gray-300 hover:text-white disabled:opacity-30" aria-label="Next page">
            <ChevronRight size={16} />
          </button>

          <div className="w-px h-4 bg-gray-700 mx-1" />

          <button onClick={zoomOut} disabled={zoomIdx <= 0}
            className="p-1.5 text-gray-300 hover:text-white disabled:opacity-30" aria-label="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-gray-400 tabular-nums w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={zoomIn} disabled={zoomIdx >= ZOOM_STEPS.length - 1}
            className="p-1.5 text-gray-300 hover:text-white disabled:opacity-30" aria-label="Zoom in">
            <ZoomIn size={16} />
          </button>

          <div className="w-px h-4 bg-gray-700 mx-1" />

          <button onClick={toggleFullscreen}
            className="p-1.5 text-gray-300 hover:text-white" aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
