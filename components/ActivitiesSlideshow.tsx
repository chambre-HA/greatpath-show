'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, MapPin, Menu, Music, Pause, Play, Users, Volume1, Volume2, VolumeX } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { OrgActivity } from '@/types'

const SLIDE_MS = 15_000
const TICK_MS = 100

const GREATPATH_BASE_URL =
  process.env.NEXT_PUBLIC_GREATPATH_URL || 'https://greatpath-greatbusiness.com'

// 新大-named classes (新大12班, 新大7班, ...) are the Singapore branch's classes.
// The org-wide activities feed has no school/branch field to filter on, so this
// mirrors what https://sg.greatpath-greatbusiness.com/activities actually shows:
// the four rooms under 悠然学堂 and 中观学堂. (云水轩 and 大禅堂 are mainland
// locations that page never lists, confirmed 2026-08-24.)
const SINGAPORE_LOCATIONS = ['中观大禅堂', '悠然大禅堂', '大愿', '大悲']

export function ActivitiesSlideshow({ className, onToggleSidebar }: { className?: string; onToggleSidebar?: () => void }) {
  const [activities, setActivities] = useState<OrgActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  // Slides start advancing on their own: this view's whole job is to be running
  // on the shared screen while attendees trickle into the Zoom room, and the
  // host is usually busy admitting people rather than pressing play. The music
  // stays opt-in — browsers block unprompted audio, and the host may already
  // have something playing.
  const [playing, setPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [musicOn, setMusicOn] = useState(false)
  const [volume, setVolume] = useState(0.6)
  const [muted, setMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/activities', { cache: 'no-store' })
        if (!res.ok) throw new Error(`加载失败 (${res.status})`)
        const data: OrgActivity[] = await res.json()
        if (!cancelled) setActivities(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const visible = useMemo(() => {
    if (!className?.includes('新大')) return activities
    return activities.filter(a => SINGAPORE_LOCATIONS.includes(a.location))
  }, [activities, className])

  // Advance slides while playing
  useEffect(() => {
    if (!playing || visible.length === 0) return
    const id = setInterval(() => {
      setElapsed(prev => {
        const next = prev + TICK_MS
        if (next >= SLIDE_MS) {
          setIndex(i => (i + 1) % visible.length)
          return 0
        }
        return next
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [playing, visible.length])

  // Keep audio element in sync with play state / volume
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = muted ? 0 : volume
  }, [volume, muted])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (musicOn) audio.play().catch(() => setMusicOn(false))
    else audio.pause()
  }, [musicOn])

  const handleTogglePlay = useCallback(() => {
    setPlaying(p => {
      if (p) return false
      setElapsed(0)
      return true
    })
  }, [])

  const goTo = useCallback((i: number) => {
    setIndex(i)
    setElapsed(0)
  }, [])

  // Keep the index in range if the visible list shrinks (an activity ends,
  // gets deactivated, or a class switches the filter while this screen is
  // left open on a shared display).
  useEffect(() => {
    setIndex(i => (i >= visible.length ? 0 : i))
  }, [visible.length])

  const current = visible[index]
  const fraction = elapsed / SLIDE_MS

  const spotsLabel = useMemo(() => {
    if (!current || current.availableSpots == null || current.totalSpots == null) return null
    return `${current.availableSpots} / ${current.totalSpots} 个名额可用`
  }, [current])

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div className="flex-1 flex flex-col bg-zinc-900 min-w-0 min-h-0 overflow-hidden relative">
      <audio ref={audioRef} src="/start-music.mp3" loop preload="auto" />

      <header className="z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur px-4 py-3.5 flex items-center gap-3 shrink-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 -ml-1.5 text-zinc-400 hover:text-white md:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
        )}
        <h1 className="flex-1 text-sm font-bold text-white leading-tight">活动展示</h1>
      </header>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 sm:p-8 relative">
        {loading && (
          <p className="text-zinc-500 text-sm">加载活动中…</p>
        )}
        {!loading && error && (
          <p className="text-rose-400 text-sm">{error}</p>
        )}
        {!loading && !error && visible.length === 0 && (
          <p className="text-zinc-500 text-sm">暂无活动</p>
        )}

        {!loading && !error && current && (
          <div className="w-full max-w-4xl aspect-video rounded-[var(--radius-md)] overflow-hidden border border-zinc-800/80 relative shadow-2xl bg-zinc-950">
            {current.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={current.id}
                src={current.imageUrl}
                alt={current.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-orange-950 to-zinc-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

            <div className="absolute top-8 right-3 sm:top-10 sm:right-5 flex flex-col items-center gap-1.5 bg-white rounded-[var(--radius-sm)] p-2 sm:p-2.5 shadow-2xl">
              <QRCodeSVG
                value={`${GREATPATH_BASE_URL}/activity/${current.id}`}
                size={72}
                level="M"
              />
              <span className="text-[10px] font-bold tracking-widest text-zinc-700">扫码报名</span>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 space-y-2.5">
              <h2 className="text-xl sm:text-3xl font-extrabold text-white leading-tight drop-shadow-sm">
                {current.title}
              </h2>
              {current.description && (
                <p className="text-sm sm:text-base text-zinc-200/90 line-clamp-2 max-w-2xl">
                  {current.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-xs sm:text-sm text-zinc-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-orange-400" />
                  {current.date}
                  {current.timeStart && ` · ${current.timeStart}${current.timeEnd ? ` - ${current.timeEnd}` : ''}`}
                </span>
                {current.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-orange-400" />
                    {current.location}
                  </span>
                )}
                {spotsLabel && (
                  <span className="flex items-center gap-1.5">
                    <Users size={14} className="text-orange-400" />
                    {spotsLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Per-slide progress dots */}
            {visible.length > 1 && (
              <div className="absolute top-3 inset-x-3 flex gap-1.5">
                {visible.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => goTo(i)}
                    className="h-1 flex-1 rounded-[var(--radius-sm)] bg-white/20 overflow-hidden"
                    aria-label={`跳转到第 ${i + 1} 个活动`}
                  >
                    <div
                      className="h-full bg-white smooth-transition"
                      style={{
                        width: i < index ? '100%' : i === index ? `${Math.min(100, fraction * 100)}%` : '0%',
                        transitionDuration: i === index ? `${TICK_MS}ms` : '0ms',
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-950/80 px-4 sm:px-8 py-4 flex items-center gap-4">
        <button
          onClick={handleTogglePlay}
          disabled={visible.length === 0}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-[var(--radius-sm)] bg-orange-600 hover:bg-orange-500 text-white active:scale-[0.97] smooth-transition text-xs font-bold disabled:opacity-40 disabled:pointer-events-none"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
          <span>{playing ? '暂停' : '播放'}</span>
        </button>

        <button
          onClick={() => setMusicOn(m => !m)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-[var(--radius-sm)] border text-xs font-semibold active:scale-[0.97] smooth-transition ${
            musicOn
              ? 'border-orange-700/50 bg-orange-950/40 text-orange-300'
              : 'border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Music size={14} />
          <span>{musicOn ? '音乐开' : '音乐关'}</span>
        </button>

        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <button
            onClick={() => setMuted(m => !m)}
            className="text-zinc-400 hover:text-white smooth-transition"
            aria-label="静音"
          >
            <VolumeIcon size={16} />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={muted ? 0 : Math.round(volume * 100)}
            onChange={e => {
              const v = parseInt(e.target.value) / 100
              setVolume(v)
              if (v > 0) setMuted(false)
            }}
            className="w-full accent-orange-500 bg-zinc-800 rounded-[var(--radius-sm)] appearance-none h-1 cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}
