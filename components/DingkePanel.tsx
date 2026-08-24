'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Maximize, Menu, Minimize, Pencil, Sparkles, Type,
} from 'lucide-react'
import { AudioBar, ScriptBlock, SlidePane } from './DingkeParts'
import { DingkeEditor } from './DingkeEditor'
import { getDingkeStore, type DingkeSectionEdit } from '@/lib/dingke-store'
import { DEFAULT_DINGKE_SECTIONS } from '@/lib/dingke-content'
import type { DedicationGroup, DingkeSection } from '@/types'

/** Script text scale, persisted per browser — hosts land on very different phones. */
const ZOOM_STEPS = [0.85, 1, 1.15, 1.35, 1.6]
const ZOOM_KEY = 'greatpath-show:dingke:zoom'

interface DingkePanelProps {
  classCode: string
  onToggleSidebar?: () => void
  /** Jumps to 活动展示 — what a host runs while attendees trickle into Zoom. */
  onShowActivities?: () => void
}

export function DingkePanel({ classCode, onToggleSidebar, onShowActivities }: DingkePanelProps) {
  // Renders the built-in script immediately; the class's own edits swap in when
  // the fetch lands, so a slow R2 read never leaves the host staring at a spinner
  // with a Zoom room waiting.
  const [sections, setSections] = useState<DingkeSection[]>(DEFAULT_DINGKE_SECTIONS)
  const [overriddenIds, setOverriddenIds] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [groups, setGroups] = useState<DedicationGroup[]>([])
  const [dedicationLoading, setDedicationLoading] = useState(true)
  const [zoomStep, setZoomStep] = useState(1)
  const [editing, setEditing] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  // Which way the last navigation moved, so the slide-in animation matches it
  // (forward slides in from the right, back from the left) rather than always
  // playing the same direction regardless of which button was pressed.
  const [direction, setDirection] = useState<1 | -1>(1)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const scriptRef = useRef<HTMLElement | null>(null)

  const store = useMemo(() => getDingkeStore(classCode), [classCode])

  const loadScript = useCallback(async () => {
    try {
      const script = await store.load()
      if (script.sections?.length) setSections(script.sections)
      setOverriddenIds(script.overriddenIds ?? [])
    } catch (e) {
      console.error('Failed to load 定课 script', e)
    }
  }, [store])

  useEffect(() => { loadScript() }, [loadScript])

  // 回向名单 is read fresh every time the panel opens: leaders often add names
  // minutes before the session starts.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/dedication?class=${encodeURIComponent(classCode)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        const data: DedicationGroup[] = await res.json()
        if (!cancelled) setGroups(data)
      } catch (e) {
        console.error('Failed to load 回向名单', e)
      } finally {
        if (!cancelled) setDedicationLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [classCode])

  useEffect(() => {
    const saved = window.localStorage.getItem(ZOOM_KEY)
    if (saved !== null) setZoomStep(Math.min(ZOOM_STEPS.length - 1, Math.max(0, parseInt(saved) || 0)))
  }, [])

  // A 12-minute chant with no touches will otherwise lock the phone mid-session.
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null
    let released = false
    navigator.wakeLock?.request('screen').then(lock => {
      if (released) lock.release().catch(() => {})
      else sentinel = lock
    }).catch(() => {})
    return () => {
      released = true
      sentinel?.release().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Every way of changing steps — arrows, keyboard, the step-bar tabs — routes
  // through here so the animation direction always matches where the host
  // actually navigated to, including a tab click that skips several steps.
  const goTo = useCallback((next: number) => {
    setIndex(i => {
      const clamped = Math.min(sections.length - 1, Math.max(0, next))
      setDirection(clamped >= i ? 1 : -1)
      return clamped
    })
  }, [sections.length])

  // A long script (修学方法, the 八步骤) leaves the panel scrolled partway down;
  // without this the next step would open already scrolled to wherever the
  // previous one left off, which reads as broken rather than as a new step.
  useEffect(() => {
    scriptRef.current?.scrollTo({ top: 0 })
  }, [index])

  const go = useCallback((delta: number) => {
    setIndex(i => {
      const clamped = Math.min(sections.length - 1, Math.max(0, i + delta))
      setDirection(delta >= 0 ? 1 : -1)
      return clamped
    })
  }, [sections.length])

  useEffect(() => {
    if (editing) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, editing])

  const cycleZoom = useCallback(() => {
    setZoomStep(step => {
      const next = (step + 1) % ZOOM_STEPS.length
      window.localStorage.setItem(ZOOM_KEY, String(next))
      return next
    })
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else rootRef.current?.requestFullscreen?.().catch(() => {})
  }, [])

  const handleSave = useCallback(async (edit: DingkeSectionEdit) => {
    await store.save(sections[index].id, edit)
    await loadScript()
  }, [store, sections, index, loadScript])

  const handleReset = useCallback(async () => {
    await store.reset(sections[index].id)
    await loadScript()
  }, [store, sections, index, loadScript])

  const section = sections[index]
  const zoom = ZOOM_STEPS[zoomStep]
  const isFirst = index === 0
  const isLast = index === sections.length - 1

  return (
    <div ref={rootRef} className="flex-1 flex flex-col bg-zinc-900 min-w-0 min-h-0 overflow-hidden relative">
      <header className="z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur px-4 py-3 flex items-center gap-3 shrink-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 -ml-1.5 text-zinc-400 hover:text-white [@media(min-width:768px)_and_(min-height:640px)]:hidden"
            aria-label="打开侧栏"
          >
            <Menu size={18} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white leading-tight truncate">
            定课 · {section.title}
            {overriddenIds.includes(section.id) && (
              <span className="ml-2 text-[10px] font-semibold text-amber-400/90 align-middle">已修改</span>
            )}
          </h1>
          {section.subtitle && (
            <p className="text-[11px] text-zinc-500 truncate mt-0.5">{section.subtitle}</p>
          )}
        </div>

        {onShowActivities && isFirst && (
          <button
            onClick={onShowActivities}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-zinc-800 text-[11px] font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 smooth-transition"
            title="等候师兄进入会议室时播放"
          >
            <Sparkles size={13} />
            <span>候场播放活动</span>
          </button>
        )}
        <button
          onClick={cycleZoom}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-zinc-800 text-[11px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 smooth-transition"
          title="调整字号"
        >
          <Type size={13} />
          <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
        </button>
        <button
          onClick={() => setEditing(true)}
          className="p-2 rounded-[var(--radius-sm)] border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 smooth-transition"
          aria-label="编辑本环节"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-[var(--radius-sm)] border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 smooth-transition"
          aria-label={fullscreen ? '退出全屏' : '全屏'}
        >
          {fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>
      </header>

      {/* Slide beside the script in landscape, stacked above it in portrait —
          both are supported layouts. The slide half carries the deck's own slate
          blue; the script half stays near-black so the two never read as one
          surface. */}
      <div className="flex-1 min-h-0 flex flex-col landscape:flex-row [@media(min-width:768px)]:flex-row">
        <SlidePane slide={section.slide} zoom={zoom} sectionId={section.id} direction={direction} video={section.video} />

        <aside
          ref={scriptRef}
          className="shrink-0 border-t landscape:border-t-0 landscape:border-l [@media(min-width:768px)]:border-t-0 [@media(min-width:768px)]:border-l border-black/60 bg-[#0B0F14] overflow-y-auto h-[45%] landscape:h-auto [@media(min-width:768px)]:h-auto w-full landscape:w-[42%] [@media(min-width:768px)]:w-[42%] landscape:max-w-lg [@media(min-width:768px)]:max-w-lg"
          style={{ fontSize: `${zoom}rem` }}
        >
          <div className="px-4 py-4 space-y-3.5">
            <p className="text-[0.68em] uppercase tracking-[0.2em] font-bold text-zinc-600">主持人念诵稿</p>

            {section.audio && section.audioFirst && <AudioBar audio={section.audio} />}

            {/* Keyed separately from AudioBar so the player never remounts (and
                so never loses playback position) on a slide change — only the
                script text itself animates in. */}
            <div
              key={section.id}
              className={`space-y-3.5 ${direction > 0 ? 'dingke-enter-fwd' : 'dingke-enter-back'}`}
            >
              {section.blocks.map((block, i) => (
                <ScriptBlock key={i} block={block} groups={groups} dedicationLoading={dedicationLoading} />
              ))}
            </div>

            {section.audio && !section.audioFirst && <AudioBar audio={section.audio} />}

            {onShowActivities && isFirst && (
              <button
                onClick={onShowActivities}
                className="sm:hidden w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[var(--radius-sm)] border border-zinc-800/80 bg-zinc-900/40 text-xs font-semibold text-zinc-400 active:scale-[0.98] smooth-transition"
              >
                <Sparkles size={14} />
                <span>候场播放活动展示</span>
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Step bar */}
      <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-950/85 px-3 py-2.5 flex items-center gap-2">
        <button
          onClick={() => go(-1)}
          disabled={isFirst}
          className="flex items-center gap-1 px-3 py-2 rounded-[var(--radius-sm)] bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200 hover:bg-zinc-800 active:scale-[0.97] smooth-transition disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft size={15} />
          <span className="hidden sm:inline">上一步</span>
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto">
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              className={`px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-semibold whitespace-nowrap smooth-transition ${
                i === index
                  ? 'bg-orange-600/20 text-orange-300 border border-orange-700/40'
                  : 'text-zinc-500 hover:text-zinc-200 border border-transparent'
              }`}
            >
              {i + 1}. {s.title}
            </button>
          ))}
        </div>

        <span className="shrink-0 text-[11px] font-mono tabular-nums text-zinc-500">
          {index + 1}/{sections.length}
        </span>

        <button
          onClick={() => go(1)}
          disabled={isLast}
          className="flex items-center gap-1 px-3 py-2 rounded-[var(--radius-sm)] bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white active:scale-[0.97] smooth-transition disabled:opacity-30 disabled:pointer-events-none"
        >
          <span className="hidden sm:inline">下一步</span>
          <ChevronRight size={15} />
        </button>
      </div>

      {editing && (
        <DingkeEditor
          section={section}
          overridden={overriddenIds.includes(section.id)}
          onSave={handleSave}
          onReset={handleReset}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
