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
  running: boolean
}

function TimerRing({ fraction }: TimerRingProps) {
  const brightCount = Math.ceil(fraction * TICK_COUNT)
  const activeColor = '#f3f4f6' // Clean white active color

  const r4 = (n: number) => Math.round(n * 10000) / 10000

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full block smooth-transition">
      {Array.from({ length: TICK_COUNT }, (_, i) => {
        const angle = (i * 360) / TICK_COUNT - 90
        const rad = (angle * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        const active = i < brightCount

        const strokeColor = active ? activeColor : '#1e293b'

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
      {/* Circular Timer Visual (Static White Theme, No Pulsing) */}
      <div className="relative aspect-square w-full max-w-[190px] mx-auto">
        <TimerRing fraction={fraction} done={isDone} low={isLow} running={running} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono font-extralight tabular-nums text-4xl tracking-tight text-white">
            {format(remaining)}
          </span>
        </div>
      </div>

      {/* White themed start/pause and control buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          disabled={remaining === 0}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-900 hover:bg-white active:scale-[0.97] smooth-transition text-xs font-bold disabled:opacity-40 disabled:pointer-events-none"
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
          <span>{running ? 'Pause' : 'Start'}</span>
        </button>
        
        <button
          onClick={addMinute}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-slate-800 text-slate-350 hover:text-white hover:bg-slate-900 active:scale-[0.97] smooth-transition text-xs font-medium"
          title="Add 1 minute"
        >
          <Plus size={14} />
          <span>1m</span>
        </button>
        
        <button
          onClick={reset}
          className="flex items-center justify-center p-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 active:scale-[0.97] smooth-transition"
          title="Reset"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Custom Duration Slider */}
      <div className="space-y-1.5 px-1 py-1 rounded-xl bg-slate-950/40 border border-slate-900/50 p-2">
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          <span>时长调节 Slider</span>
          <span className="font-mono text-slate-300">{Math.round(targetMs / 60_000)} 分钟</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={60}
            value={Math.round(targetMs / 60_000)}
            onChange={e => {
              const mins = parseInt(e.target.value) || 5
              setPreset(mins * 60_000)
            }}
            className="w-full accent-white bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
          />
        </div>
      </div>

      {/* Presets Grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPreset(p.ms)}
            className={`py-1.5 rounded-xl text-xs font-semibold border smooth-transition ${
              targetMs === p.ms
                ? 'bg-slate-100 text-slate-900 border-slate-100 shadow-sm'
                : 'border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
