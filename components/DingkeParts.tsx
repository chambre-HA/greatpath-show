'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Volume1, Volume2, VolumeX } from 'lucide-react'
import type { DedicationGroup, DingkeAudio, DingkeBlock, DingkeSlide } from '@/types'

/**
 * Palette lifted from the 定课 deck itself, so the shared screen still looks
 * like the thing everyone has been reading for years: slides sit on its slate
 * blue, and its amber is the one accent. The host's script panel deliberately
 * uses none of it — it stays near-black and low-contrast so the two halves read
 * as "the room's screen" and "my notes" at a glance.
 */
const DECK_SLATE = '#465C70'
const DECK_SLATE_DEEP = '#3A4D5E'
const DECK_AMBER = '#FEAE00'

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/* ── Slide half — what the room reads ────────────────────────────────────── */

type SlideRow =
  /** Amber section title. The kicker is one of these, not a separate tier. */
  | { kind: 'label'; text: string }
  /** The words the room says or reads. */
  | { kind: 'line'; text: string }
  /** Supporting detail — a navigation path, an instruction, a sub-item. */
  | { kind: 'detail'; text: string }

function toRow(line: string): SlideRow {
  if (line.startsWith('#')) return { kind: 'label', text: line.replace(/^#\s*/, '') }
  if (line.startsWith('-')) return { kind: 'detail', text: line.replace(/^-\s*/, '') }
  return { kind: 'line', text: line }
}

/**
 * Three tiers, and only three: one amber label style shared by the kicker and
 * every `#` label, one weight for the words being said, and a lighter, smaller
 * one for supporting detail (五处用心 —— 定课 —— 打卡 and friends), which would
 * otherwise shout as loudly as the line it belongs to.
 *
 * Type sizes are capped against the viewport height as well as the zoom step:
 * a phone held in landscape is only ~380px tall, and a 4-line chant at desktop
 * sizes would push its last line under the step bar. The `min-h-full` wrapper
 * keeps the content optically centred while still allowing a scroll when it
 * genuinely doesn't fit (very large zoom on a very short screen).
 */
export function SlidePane({ slide, zoom }: { slide: DingkeSlide; zoom: number }) {
  const size = (rem: number, vh: number) => `min(${rem * zoom}rem, ${vh}vh)`

  const rows: SlideRow[] = [
    ...(slide.kicker ? [{ kind: 'label' as const, text: slide.kicker }] : []),
    ...slide.lines.map(toRow),
  ]

  return (
    <div
      className="flex-1 min-w-0 min-h-0 overflow-y-auto"
      style={{ background: `linear-gradient(160deg, ${DECK_SLATE} 0%, ${DECK_SLATE_DEEP} 100%)` }}
    >
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-4 text-center">
        <div className="w-full max-w-3xl">
          {rows.map((row, i) => {
            const prev = rows[i - 1]
            switch (row.kind) {
              case 'label':
                return (
                  <p
                    key={i}
                    className={`font-bold tracking-[0.3em] mb-2.5 ${i > 0 ? 'mt-5' : ''}`}
                    style={{ fontSize: size(0.68, 2.3), color: DECK_AMBER }}
                  >
                    {row.text}
                  </p>
                )
              case 'detail':
                return (
                  <p
                    key={i}
                    // Tucked under the line it qualifies, but given room of its
                    // own when a run of details stands alone.
                    className={`text-white/60 font-light leading-relaxed tracking-[0.04em] ${
                      prev?.kind === 'line' ? 'mt-2.5' : 'mt-1.5'
                    }`}
                    style={{ fontSize: size(1, 3.3) }}
                  >
                    {row.text}
                  </p>
                )
              default:
                return (
                  <p
                    key={i}
                    className={`text-white font-semibold leading-snug tracking-[0.08em] ${
                      prev && prev.kind !== 'label' ? 'mt-2.5' : ''
                    }`}
                    style={{ fontSize: size(1.55, 5) }}
                  >
                    {row.text}
                  </p>
                )
            }
          })}
        </div>
      </div>
    </div>
  )
}

/* ── Script half — the host's notes ──────────────────────────────────────── */

function DedicationBlock({ groups, loading }: { groups: DedicationGroup[]; loading: boolean }) {
  const active = groups
    .map(g => ({ ...g, people: g.people.filter(p => !p.paused) }))
    .filter(g => g.people.length > 0)

  if (loading) return <p className="text-slate-600 italic">读取回向名单中…</p>
  if (active.length === 0) {
    return (
      <p className="text-slate-500 italic leading-relaxed">
        本周回向名单为空 —— 可在侧栏「回向名单」中添加，或直接念诵下方回向偈。
      </p>
    )
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3">
      <p className="text-[0.7em] uppercase tracking-wider font-bold text-slate-500">本周回向名单</p>
      {active.map((group, i) => (
        <div key={group.id} className="leading-relaxed text-slate-400">
          <span>{i + 1}. 祝愿 </span>
          <span className="text-slate-200 font-semibold">{group.people.map(p => p.name).join('、')}</span>
          <span>，{group.purpose}。</span>
        </div>
      ))}
      <p className="text-slate-400 leading-relaxed">以及一切有同样心愿的众生，愿他们所愿皆成！</p>
    </div>
  )
}

export function ScriptBlock({
  block, groups, dedicationLoading,
}: { block: DingkeBlock; groups: DedicationGroup[]; dedicationLoading: boolean }) {
  switch (block.kind) {
    case 'dedication':
      return <DedicationBlock groups={groups} loading={dedicationLoading} />
    // The one thing the host must not miss mid-session, so it gets the deck's
    // amber — the only borrowed colour on this side of the screen.
    case 'cue':
      return (
        <p
          className="rounded-xl border px-4 py-2.5 font-semibold leading-relaxed"
          style={{
            color: DECK_AMBER,
            borderColor: 'rgba(254, 174, 0, 0.28)',
            backgroundColor: 'rgba(254, 174, 0, 0.07)',
          }}
        >
          {block.text}
        </p>
      )
    case 'chant':
      return (
        <div className="rounded-xl bg-slate-900/40 border border-slate-800/80 px-4 py-3">
          {block.label && (
            <p className="text-[0.7em] uppercase tracking-wider font-bold text-slate-600 mb-1.5">{block.label}</p>
          )}
          <p className="text-slate-200 font-semibold leading-loose tracking-[0.08em] whitespace-pre-line">
            {block.text}
          </p>
        </div>
      )
    case 'note':
      return <p className="text-slate-500 italic leading-relaxed">※ {block.text}</p>
    case 'list':
      return (
        <div className="space-y-1.5">
          {block.label && (
            <p className="text-[0.7em] uppercase tracking-wider font-bold text-slate-600">{block.label}</p>
          )}
          {block.items.map((item, i) => (
            <p key={i} className="text-slate-400 leading-relaxed">{item}</p>
          ))}
        </div>
      )
    default:
      return (
        <div>
          {block.label && <p className="text-slate-200 font-bold mb-1 tracking-[0.15em]">{block.label}</p>}
          <p className="text-slate-400 leading-relaxed whitespace-pre-line">{block.text}</p>
        </div>
      )
  }
}

/* ── Audio ───────────────────────────────────────────────────────────────── */

/**
 * The deck's embedded MP3s only ever played inside PowerPoint's slideshow mode;
 * here they are plain R2 objects. Note the 慈经 track already carries its ~3
 * minutes of 止静 as silence before the end, so finishing the track is the cue
 * to move on — there is nothing to time separately.
 */
export function AudioBar({ audio }: { audio: DingkeAudio }) {
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
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 space-y-2.5">
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
        onEnded={() => setPlaying(false)}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-slate-950 active:scale-[0.96] smooth-transition hover:brightness-110"
          style={{ backgroundColor: DECK_AMBER }}
          aria-label={playing ? '暂停' : `播放${audio.label}`}
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-200 truncate">{audio.label}</p>
          <p className="text-[11px] text-slate-500 font-mono tabular-nums">
            {formatClock(position)} / {formatClock(duration)}
          </p>
        </div>
        <button
          onClick={() => seek(0)}
          className="p-2 text-slate-500 hover:text-slate-200 smooth-transition"
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
        className="w-full bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
        style={{ accentColor: DECK_AMBER }}
        aria-label="播放进度"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => setMuted(m => !m)}
          className="text-slate-500 hover:text-slate-200 smooth-transition"
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
          className="flex-1 accent-slate-500 bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
          aria-label="音量"
        />
      </div>
    </div>
  )
}
