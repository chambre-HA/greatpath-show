'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, Users } from 'lucide-react'
import html2canvas from 'html2canvas'
import type { SessionType } from '@/lib/classCheckins'

const POLL_MS = 8000

export function ClassCheckinRoster({
  className,
  sessionDate,
  sessionType,
  sessionPeriod,
  groupNumber,
  sessionLabel,
}: {
  className: string
  sessionDate: string
  sessionType: SessionType
  sessionPeriod?: 'morning' | 'evening' | null
  groupNumber?: number | null
  sessionLabel: string
}) {
  const [names, setNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [isCapturing, setIsCapturing] = useState(false)
  const snapshotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const poll = async () => {
      try {
        const res = await fetch('/api/class-checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ className, sessionDate, sessionType, sessionPeriod, groupNumber }),
        })
        const data = await res.json()
        if (!cancelled) setNames(data?.names ?? [])
      } catch {
        // Transient network hiccups just keep showing the last known list.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [className, sessionDate, sessionType, sessionPeriod, groupNumber])

  const handleScreenshot = async () => {
    if (!snapshotRef.current) return
    setIsCapturing(true)
    try {
      const canvas = await html2canvas(snapshotRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      })
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png', 1.0)
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${className}-${sessionLabel}-${sessionDate}-签到名单.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Error generating attendance screenshot:', e)
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md">
      <div ref={snapshotRef} className="w-full bg-white text-black rounded-2xl p-5">
        <p className="text-base font-bold text-center">{className}</p>
        <p className="text-xs text-center text-gray-500 mt-1 mb-4">
          {sessionLabel} · {sessionDate}
        </p>
        {loading && names.length === 0 ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : names.length === 0 ? (
          <p className="text-sm text-center text-gray-400 py-4">暂无学员签到</p>
        ) : (
          <div className="flex flex-wrap gap-2 justify-center">
            {names.map((name) => (
              <span key={name} className="text-sm px-2.5 py-1 rounded-full bg-gray-100 text-gray-800">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between w-full text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <Users size={12} />
          已签到 {names.length} 人 · 每 {POLL_MS / 1000} 秒自动刷新
        </span>
        <button
          onClick={handleScreenshot}
          disabled={names.length === 0 || isCapturing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-800 text-gray-300 hover:text-white hover:bg-gray-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          {isCapturing ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          保存截图
        </button>
      </div>
    </div>
  )
}
