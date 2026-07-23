'use client'

import { ArrowLeft, HeartHandshake, MessageSquare, Presentation, Sparkles } from 'lucide-react'
import { CountdownTimer } from './CountdownTimer'

export type ClassFunction = 'presentation' | 'dedication' | 'messages' | 'activities'

const FUNCTIONS: { value: ClassFunction; label: string; icon: typeof Presentation; iconBg: string; iconColor: string }[] = [
  { value: 'presentation', label: '演示文稿', icon: Presentation, iconBg: 'bg-amber-950/40 border-amber-900/30', iconColor: 'text-amber-500' },
  { value: 'activities', label: '活动展示', icon: Sparkles, iconBg: 'bg-violet-950/40 border-violet-900/30', iconColor: 'text-violet-400' },
  { value: 'dedication', label: '回向名单', icon: HeartHandshake, iconBg: 'bg-pink-950/40 border-pink-900/30', iconColor: 'text-pink-400' },
  { value: 'messages', label: '消息模板', icon: MessageSquare, iconBg: 'bg-teal-950/40 border-teal-900/30', iconColor: 'text-teal-400' },
]

interface SidebarProps {
  className: string
  activeFunction: ClassFunction
  isOpen: boolean
  onSelectFunction: (fn: ClassFunction) => void
  onBack: () => void
}

export function Sidebar({ className, activeFunction, isOpen, onSelectFunction, onBack }: SidebarProps) {
  return (
    <aside className={`w-72 shrink-0 h-screen flex flex-col bg-gray-950 border-r border-gray-800/80 fixed md:relative z-45 transition-transform duration-300 ${
      isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-800/60 shrink-0 bg-gray-950/40">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-900 border border-transparent hover:border-gray-800/50 smooth-transition"
            aria-label="返回"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-extrabold text-white tracking-tight leading-tight">大道大商 . 共修平台</h1>
            <p className="text-[11px] text-gray-500 font-medium truncate mt-0.5">{className}</p>
          </div>
        </div>
      </div>

      {/* Function selector */}
      <nav className="flex-1 min-h-0 px-3 py-4 space-y-1.5 overflow-y-auto">
        <p className="px-3 text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">功能导航</p>
        {FUNCTIONS.map(fn => {
          const Icon = fn.icon
          const active = fn.value === activeFunction
          return (
            <button
              key={fn.value}
              onClick={() => onSelectFunction(fn.value)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium smooth-transition border border-transparent ${
                active
                  ? 'bg-emerald-600/15 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-gray-900/60 hover:border-gray-800/40'
              }`}
            >
              <div className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${fn.iconBg}`}>
                <Icon size={14} className={fn.iconColor} />
              </div>
              <span className="flex-1 text-left">{fn.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Timer — pinned at bottom */}
      <div className="px-4 pt-2 pb-[50px] border-t border-gray-800/60 shrink-0 bg-gray-950/80">
        <h2 className="px-3 text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">计时器</h2>
        <CountdownTimer />
      </div>
    </aside>
  )
}
