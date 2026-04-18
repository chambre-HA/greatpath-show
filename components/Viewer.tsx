'use client'

import dynamic from 'next/dynamic'
import { useRef, useState, useEffect } from 'react'
import { AlertTriangle, ExternalLink, FileQuestion, Maximize2, Minimize2 } from 'lucide-react'
import { getEmbedStrategy } from '@/lib/embed'
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
  link: ShowLink | null
}

export function Viewer({ link }: ViewerProps) {
  if (!link) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
        <FileQuestion size={48} className="mb-3 opacity-40" />
        <p className="text-sm">Select a file from the sidebar</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900 min-w-0">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-950">
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
        ) : (
          <PptxViewer link={link} />
        )}
      </div>
    </div>
  )
}

const OFFICE_ONLINE_MAX_BYTES = 50 * 1024 * 1024

function PptxViewer({ link }: { link: ShowLink }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const strategy = getEmbedStrategy(link)

  useEffect(() => { setLoaded(false) }, [link.url])
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
