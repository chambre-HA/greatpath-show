'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, Plus, RotateCcw } from 'lucide-react'

const PRESETS = [
  { label: '5m', ms: 5 * 60_000 },
  { label: '10m', ms: 10 * 60_000 },
  { label: '15m', ms: 15 * 60_000 },
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

function TimerRing({ fraction, done, low }: TimerRingProps) {
  const brightCount = Math.ceil(fraction * TICK_COUNT)
  const activeColor = done ? '#f87171' : low ? '#fbbf24' : '#f3f4f6'

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full block">
      {Array.from({ length: TICK_COUNT }, (_, i) => {
        const angle = (i * 360) / TICK_COUNT - 90
        const rad = (angle * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        const active = i < brightCount
        return (
          <line
            key={i}
            x1={100 + TICK_INNER * cos}
            y1={100 + TICK_INNER * sin}
            x2={100 + TICK_OUTER * cos}
            y2={100 + TICK_OUTER * sin}
            stroke={active ? activeColor : '#2a2f3a'}
            strokeWidth={2}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
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
    <div className="space-y-3">
      <div className="relative aspect-square w-full max-w-[220px] mx-auto">
        <TimerRing fraction={fraction} done={isDone} low={isLow} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`font-mono font-extralight tabular-nums text-5xl tracking-tight transition-colors ${
              isDone ? 'text-red-400' : isLow ? 'text-amber-300' : 'text-white'
            }`}
          >
            {format(remaining)}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          disabled={remaining === 0}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 text-gray-900 hover:bg-white disabled:opacity-40 text-sm font-medium"
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          onClick={addMinute}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-full border border-gray-700 text-gray-200 hover:bg-gray-800 text-sm"
          title="Add 1 minute"
        >
          <Plus size={14} /> 1m
        </button>
        <button
          onClick={reset}
          className="flex items-center justify-center p-2 rounded-full border border-gray-700 text-gray-300 hover:bg-gray-800"
          title="Reset"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPreset(p.ms)}
            className={`py-1.5 rounded-full text-xs font-medium border transition ${
              targetMs === p.ms
                ? 'bg-gray-100 text-gray-900 border-gray-100'
                : 'border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
