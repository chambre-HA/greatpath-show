'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, RotateCw, Volume1, Volume2, VolumeX } from 'lucide-react'
import type { DedicationGroup, DingkeAudio, DingkeBlock, DingkeSlide } from '@/types'

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/* ── Landscape nudge ─────────────────────────────────────────────────────── */

/**
 * The whole point of 定课 on a phone is a big readable script beside the slide,
 * which needs the long edge. Shown once per session on a portrait phone; if the
 * host dismisses it the layout just stacks instead.
 */
export function LandscapeNudge({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="absolute inset-0 z-50 bg-gray-950/95 backdrop-blur flex flex-col items-center justify-center gap-6 px-8 text-center">
      <div className="relative">
        <div className="w-16 h-24 rounded-xl border-2 border-emerald-500/70 animate-glow-pulse" />
        <RotateCw size={28} className="text-emerald-400 absolute -right-8 top-1/2 -translate-y-1/2" />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-bold text-white">请横屏使用</p>
        <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
          横屏后左边是大字内容，右边是主持人念诵稿，读起来更清楚。
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="px-5 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 smooth-transition"
      >
        仍要竖屏使用
      </button>
    </div>
  )
}

/* ── Slide half ──────────────────────────────────────────────────────────── */

/**
 * Type sizes are capped against the viewport height as well as the zoom step:
 * a phone held in landscape is only ~380px tall, and a 4-line chant at desktop
 * sizes would push its last line under the step bar. The `min-h-full` inner
 * wrapper keeps the content optically centred while still being scrollable when
 * it genuinely doesn't fit (very large zoom on a very short screen).
 */
export function SlidePane({ slide, zoom }: { slide: DingkeSlide; zoom: number }) {
  const size = (rem: number, vh: number) => `min(${rem * zoom}rem, ${vh}vh)`

  return (
    <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-5 text-center">
        {slide.kicker && (
          <p
            className="uppercase tracking-[0.35em] text-emerald-400/80 font-bold mb-3 shrink-0"
            style={{ fontSize: size(0.7, 2.8) }}
          >
            {slide.kicker}
          </p>
        )}
        <h2
          className="font-extrabold text-white leading-tight tracking-tight mb-5"
          style={{ fontSize: size(2.1, 8.5) }}
        >
          {slide.headline}
        </h2>
        <div
          className={slide.chant ? 'space-y-2' : 'space-y-1.5 max-w-3xl'}
          style={{ fontSize: slide.chant ? size(1.5, 5.6) : size(1.15, 4.4) }}
        >
          {slide.lines.map((line, i) => (
            <p
              key={i}
              className={slide.chant
                ? 'text-slate-100 font-semibold tracking-[0.12em] leading-snug'
                : 'text-slate-300 leading-relaxed'}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Script half ─────────────────────────────────────────────────────────── */

function DedicationBlock({ groups, loading }: { groups: DedicationGroup[]; loading: boolean }) {
  const active = groups
    .map(g => ({ ...g, people: g.people.filter(p => !p.paused) }))
    .filter(g => g.people.length > 0)

  if (loading) return <p className="text-slate-500 italic">读取回向名单中…</p>
  if (active.length === 0) {
    return (
      <p className="text-amber-400/90 italic">
        本周回向名单为空 —— 可在侧栏「回向名单」中添加，或直接念诵下方回向偈。
      </p>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-pink-900/40 bg-pink-950/15 px-4 py-3">
      <p className="text-[0.75em] uppercase tracking-wider font-bold text-pink-400/90">本周回向名单</p>
      {active.map((group, i) => (
        <div key={group.id} className="leading-relaxed">
          <span className="text-slate-100 font-semibold">{i + 1}. 祝愿 </span>
          <span className="text-white font-bold">{group.people.map(p => p.name).join('、')}</span>
          <span className="text-slate-300">，{group.purpose}。</span>
        </div>
      ))}
      <p className="text-slate-300 leading-relaxed">以及一切有同样心愿的众生，愿他们所愿皆成！</p>
    </div>
  )
}

export function ScriptBlock({
  block, groups, dedicationLoading,
}: { block: DingkeBlock; groups: DedicationGroup[]; dedicationLoading: boolean }) {
  switch (block.kind) {
    case 'dedication':
      return <DedicationBlock groups={groups} loading={dedicationLoading} />
    case 'cue':
      return (
        <p className="rounded-xl border border-emerald-800/50 bg-emerald-950/25 px-4 py-2.5 text-emerald-200 font-semibold leading-relaxed">
          {block.text}
        </p>
      )
    case 'chant':
      return (
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 px-4 py-3">
          {block.label && (
            <p className="text-[0.72em] uppercase tracking-wider font-bold text-slate-500 mb-1.5">{block.label}</p>
          )}
          <p className="text-white font-bold leading-loose tracking-[0.08em] whitespace-pre-line">{block.text}</p>
        </div>
      )
    case 'note':
      return <p className="text-amber-400/85 italic leading-relaxed">※ {block.text}</p>
    case 'list':
      return (
        <div className="space-y-1.5">
          {block.label && (
            <p className="text-[0.72em] uppercase tracking-wider font-bold text-slate-500">{block.label}</p>
          )}
          {block.items.map((item, i) => (
            <p key={i} className="text-slate-300 leading-relaxed">{item}</p>
          ))}
        </div>
      )
    default:
      return (
        <div>
          {block.label && <p className="text-white font-bold mb-1 tracking-[0.15em]">{block.label}</p>}
          <p className="text-slate-300 leading-relaxed whitespace-pre-line">{block.text}</p>
        </div>
      )
  }
}

/* ── Audio ───────────────────────────────────────────────────────────────── */

/**
 * The deck's embedded MP3s only ever played inside PowerPoint's slideshow mode;
 * here they are plain R2 objects. `onEnded` is how the 慈经 section kicks off its
 * 止静 countdown without the host having to notice the track finished.
 */
export function AudioBar({ audio, onEnded }: { audio: DingkeAudio; onEnded?: () => void }) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(audio.durationSec)
  const [volume, setVolume] = useState(0.85)
  const [muted, setMuted] = useState(false)

  // A new src on the same element keeps the old playing state; reset with it.
  useEffect(() => {
    setPlaying(false)
    setPosition(0)
    setDuration(audio.durationSec)
  }, [audio.src, audio.durationSec])

  useEffect(() => {
    const el = ref.current
    if (el) el.volume = muted ? 0 : volume
  }, [volume, muted])

  const toggle = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (el.paused) el.play().catch(() => setPlaying(false))
    else el.pause()
  }, [])

  const seek = useCallback((seconds: number) => {
    const el = ref.current
    if (el) el.currentTime = seconds
  }, [])

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const fraction = duration > 0 ? Math.min(1, position / duration) : 0

  return (
    <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 space-y-2.5">
      <audio
        ref={ref}
        src={audio.src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={e => setPosition(e.currentTarget.currentTime)}
        onLoadedMetadata={e => {
          if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration)
        }}
        onEnded={() => {
          setPlaying(false)
          onEnded?.()
        }}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="w-11 h-11 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center active:scale-[0.96] smooth-transition"
          aria-label={playing ? '暂停' : `播放${audio.label}`}
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{audio.label}</p>
          <p className="text-[11px] text-emerald-300/70 font-mono tabular-nums">
            {formatClock(position)} / {formatClock(duration)}
          </p>
        </div>
        <button
          onClick={() => seek(0)}
          className="p-2 text-slate-400 hover:text-white smooth-transition"
          aria-label="从头播放"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(fraction * 1000)}
        onChange={e => seek((parseInt(e.target.value) / 1000) * duration)}
        className="w-full accent-emerald-400 bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
        aria-label="播放进度"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => setMuted(m => !m)}
          className="text-slate-400 hover:text-white smooth-transition"
          aria-label="静音"
        >
          <VolumeIcon size={15} />
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
          className="flex-1 accent-slate-400 bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
          aria-label="音量"
        />
      </div>
    </div>
  )
}

/* ── 止静 countdown ──────────────────────────────────────────────────────── */

export function StillnessTimer({ minutes, autoStartKey }: { minutes: number; autoStartKey: number }) {
  const totalMs = minutes * 60_000
  const [remaining, setRemaining] = useState(totalMs)
  const [running, setRunning] = useState(false)
  const endAtRef = useRef<number | null>(null)

  // Bumped by the audio's `ended` event, so 止静 starts the moment 慈经 finishes.
  useEffect(() => {
    if (autoStartKey === 0) return
    setRemaining(totalMs)
    setRunning(true)
  }, [autoStartKey, totalMs])

  useEffect(() => {
    if (!running) return
    endAtRef.current = Date.now() + remaining
    const id = setInterval(() => {
      const left = (endAtRef.current ?? 0) - Date.now()
      if (left <= 0) {
        setRemaining(0)
        setRunning(false)
        const bell = new Audio('/bell-2.mp3')
        bell.volume = 0.8
        bell.play().catch(() => {})
      } else {
        setRemaining(left)
      }
    }, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const done = remaining === 0

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3 flex items-center gap-3">
      <span className="text-[0.75em] uppercase tracking-wider font-bold text-slate-500 shrink-0">止静</span>
      <span className={`font-mono tabular-nums text-2xl font-light ${done ? 'text-rose-400' : 'text-white'}`}>
        {formatClock(remaining / 1000)}
      </span>
      <div className="flex-1" />
      <button
        onClick={() => setRunning(r => !r)}
        disabled={done}
        className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-900 text-xs font-bold whitespace-nowrap hover:bg-white active:scale-[0.97] smooth-transition disabled:opacity-40 disabled:pointer-events-none"
      >
        {running ? '暂停' : '开始'}
      </button>
      <button
        onClick={() => { setRemaining(totalMs); setRunning(false) }}
        className="p-1.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 smooth-transition"
        aria-label="重置"
      >
        <RotateCcw size={14} />
      </button>
    </div>
  )
}
