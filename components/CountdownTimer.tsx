'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, Plus, RotateCcw } from 'lucide-react'

const PRESETS = [
  { label: '3m', ms: 3 * 60_000 },
  { label: '5m', ms: 5 * 60_000 },
  { label: '10m', ms: 10 * 60_000 },
  { label: '20m', ms: 20 * 60_000 },
]

const TICK_COUNT = 60
const TICK_INNER = 72
const TICK_OUTER = 86

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface TimerRingProps {
  fraction: number
  done: boolean
  low: boolean
}

/**
 * Ink-neutral by default — white ticks and number, matching the system's
 * "one accent used sparingly" rule. Orange only enters in the last minute
 * (elapsed ticks turn accent to read as urgency, not decoration), and red
 * marks done. The dial itself carries no color of its own.
 */
function TimerRing({ fraction, done, low }: TimerRingProps) {
  const brightCount = Math.ceil(fraction * TICK_COUNT)
  const activeColor = done ? '#f87171' : low ? '#f97316' : '#fafafa'

  const r4 = (n: number) => Math.round(n * 10000) / 10000

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full block smooth-transition">
      {Array.from({ length: TICK_COUNT }, (_, i) => {
        const angle = (i * 360) / TICK_COUNT - 90
        const rad = (angle * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        const active = i < brightCount

        const strokeColor = active ? activeColor : '#3f3f46'

        return (
          <line
            key={i}
            x1={r4(100 + TICK_INNER * cos)}
            y1={r4(100 + TICK_INNER * sin)}
            x2={r4(100 + TICK_OUTER * cos)}
            y2={r4(100 + TICK_OUTER * sin)}
            stroke={strokeColor}
            strokeWidth={active ? 2.5 : 1.5}
            strokeLinecap="round"
            className="smooth-transition"
          />
        )
      })}
    </svg>
  )
}

function playBellChime() {
  const bell = new Audio('/bell-2.mp3')
  bell.volume = 0.8
  bell.play().catch(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()

      const playTone = (freq: number, start: number, duration: number, volume: number) => {
        const osc = ctx.createOscillator()
        const gainNode = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, start)

        gainNode.gain.setValueAtTime(0, start)
        gainNode.gain.linearRampToValueAtTime(volume, start + 0.04)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration)

        osc.connect(gainNode)
        gainNode.connect(ctx.destination)

        osc.start(start)
        osc.stop(start + duration)
      }

      const now = ctx.currentTime
      playTone(523.25, now, 2.5, 0.4) // C5
      playTone(659.25, now + 0.08, 2.5, 0.3) // E5
      playTone(783.99, now + 0.16, 2.5, 0.25) // G5
      playTone(1046.50, now + 0.24, 3.0, 0.15) // C6
    } catch (e) {
      console.error('Failed to synthesize chime', e)
    }
  })
}

export function CountdownTimer() {
  const [targetMs, setTargetMs] = useState(5 * 60_000)
  const [remaining, setRemaining] = useState(5 * 60_000)
  const [running, setRunning] = useState(false)
  const endAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (!running) return
    endAtRef.current = Date.now() + remaining
    const id = setInterval(() => {
      const left = (endAtRef.current ?? 0) - Date.now()
      if (left <= 0) {
        setRemaining(0)
        setRunning(false)
        playBellChime()
      } else {
        setRemaining(left)
      }
    }, 150)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const fraction = targetMs > 0 ? Math.max(0, Math.min(1, remaining / targetMs)) : 0
  const isDone = remaining === 0
  const isLow = remaining > 0 && remaining <= 60_000

  const setPreset = useCallback((ms: number) => {
    setTargetMs(ms)
    setRemaining(ms)
    setRunning(false)
  }, [])

  const addMinute = useCallback(() => {
    setRemaining((r) => r + 60_000)
    setTargetMs((t) => t + 60_000)
    if (isDone) setRunning(true)
  }, [isDone])

  const reset = useCallback(() => {
    setRemaining(targetMs)
    setRunning(false)
  }, [targetMs])

  return (
    <div className="space-y-4">
      {/* Dial — ink-neutral by default, orange enters only in the last minute. */}
      <div className="relative aspect-square w-full max-w-[190px] mx-auto">
        <TimerRing fraction={fraction} done={isDone} low={isLow} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-mono font-light tabular-nums text-4xl tracking-tight smooth-transition ${
            isDone ? 'text-rose-400' : isLow ? 'text-orange-400' : 'text-zinc-50'
          }`}>
            {format(remaining)}
          </span>
        </div>
      </div>

      {/* Duration slider */}
      <div className="px-3 py-2.5 rounded-[var(--radius-sm)] border border-zinc-800 bg-zinc-950/40">
        <input
          type="range"
          min={1}
          max={60}
          value={Math.round(targetMs / 60_000)}
          onChange={e => {
            const mins = parseInt(e.target.value) || 5
            setPreset(mins * 60_000)
          }}
          className="w-full accent-zinc-100 bg-zinc-800 rounded-[var(--radius-sm)] appearance-none h-1 cursor-pointer"
        />
      </div>

      {/* Ghost start/pause + controls — hairline border, no fill, no ring.
          The only orange in this row is the hover state, matching the rule
          that brand accent stays a single small touch, not the whole control. */}
      <div className="flex gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          disabled={remaining === 0}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[var(--radius-sm)] border border-zinc-700 text-zinc-100 hover:border-orange-500/60 hover:text-orange-300 active:scale-[0.98] smooth-transition text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none"
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
          <span>{running ? '暂停' : '开始'}</span>
        </button>

        <button
          onClick={addMinute}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-[var(--radius-sm)] border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 active:scale-[0.98] smooth-transition text-xs font-medium"
          title="加一分钟"
        >
          <Plus size={14} />
          <span>1m</span>
        </button>

        <button
          onClick={reset}
          className="flex items-center justify-center p-2 rounded-[var(--radius-sm)] border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 active:scale-[0.98] smooth-transition"
          title="重置"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Presets — flush row, single-selected state via hairline + accent text */}
      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPreset(p.ms)}
            className={`py-1.5 rounded-[var(--radius-sm)] text-xs font-semibold border smooth-transition ${
              targetMs === p.ms
                ? 'border-orange-500/60 text-orange-300 bg-orange-950/20'
                : 'border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
