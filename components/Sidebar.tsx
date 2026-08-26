'use client'

import { useState } from 'react'
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, ExternalLink, Flower2, HeartHandshake, MessageSquare, Presentation, QrCode, Sparkles } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { CountdownTimer } from './CountdownTimer'
import type { ClassSignin } from '@/types'

export type ClassFunction = 'dingke' | 'presentation' | 'dedication' | 'messages' | 'activities' | 'signin' | 'resources'

const FUNCTIONS: { value: ClassFunction; label: string; icon: typeof Presentation }[] = [
  { value: 'dingke', label: '手机版定课', icon: Flower2 },
  { value: 'presentation', label: '演示文稿', icon: Presentation },
  { value: 'activities', label: '活动展示', icon: Sparkles },
  { value: 'dedication', label: '回向名单', icon: HeartHandshake },
  { value: 'messages', label: '消息模板', icon: MessageSquare },
  { value: 'resources', label: '常用资源', icon: BookOpen },
]

interface SidebarProps {
  className: string
  activeFunction: ClassFunction
  isOpen: boolean
  signin?: ClassSignin | null
  onSelectFunction: (fn: ClassFunction) => void
  onBack: () => void
}

export function Sidebar({ className, activeFunction, isOpen, signin, onSelectFunction, onBack }: SidebarProps) {
  const [qrCollapsed, setQrCollapsed] = useState(false)

  return (
    <aside className={`w-72 shrink-0 h-screen flex flex-col bg-zinc-950 border-r border-zinc-800/80 fixed [@media(min-width:768px)_and_(min-height:640px)]:relative z-45 transition-transform duration-300 ${
      isOpen ? 'translate-x-0' : '-translate-x-full [@media(min-width:768px)_and_(min-height:640px)]:translate-x-0'
    }`}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 shrink-0 bg-zinc-950/40">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-[var(--radius-sm)] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800/50 smooth-transition"
            aria-label="返回"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-extrabold text-white tracking-tight leading-tight">大道大商 . 共修平台</h1>
            <p className="text-[11px] text-zinc-500 font-medium truncate mt-0.5">{className}</p>
          </div>
        </div>
      </div>

      {/* Function selector */}
      {/* Navigation keeps its full height and the timer below it takes the
          squeeze: on a laptop the timer is tall enough to push every function
          but the first off screen, and the sidebar is the only way to reach
          them. */}
      <nav className="shrink-0 px-3 py-4 space-y-1.5">
        <p className="px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1">功能导航</p>
        {FUNCTIONS.map(fn => {
          const Icon = fn.icon
          const active = fn.value === activeFunction
          return (
            <button
              key={fn.value}
              onClick={() => onSelectFunction(fn.value)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-sm)] text-sm font-semibold smooth-transition ${
                active
                  ? 'bg-orange-500/12 text-zinc-50'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Icon size={16} className={`shrink-0 ${active ? 'text-orange-400' : ''}`} />
              <span className="flex-1 text-left">{fn.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Timer — pinned at bottom */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-2 border-t border-zinc-800 bg-zinc-950/80">
        <h2 className="px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-1">计时器</h2>
        <CountdownTimer />
      </div>

      {/* Sign-in QR — the only entry point for sign-in: always on screen
          (collapsible) so latecomers can scan during any function, and tapping
          it opens the enlarged view, where the class also maintains its own
          check-in link. Stays visible with no link yet, so a class can get
          there to add one. */}
      <div className="px-4 py-3 border-t border-zinc-800 shrink-0 bg-zinc-950/80">
        <button
          onClick={() => setQrCollapsed(prev => !prev)}
          className="w-full flex items-center justify-between px-3 text-zinc-500 hover:text-zinc-300 smooth-transition"
          aria-expanded={!qrCollapsed}
        >
          <h2 className="text-[10px] uppercase font-bold tracking-wider">签到二维码</h2>
          {qrCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {!qrCollapsed && (
          signin ? (
            <div className="mt-1.5 rounded-[var(--radius-sm)] hover:bg-zinc-900/60 smooth-transition">
              <button
                onClick={() => onSelectFunction('signin')}
                className="w-full flex items-center gap-3 px-3 py-1.5"
                title="点击放大"
              >
                <span className="flex-1 text-left leading-snug min-w-0">
                  {signin.passcode ? (
                    <>
                      <span className="block text-[10px] uppercase font-bold tracking-wider text-zinc-500 truncate">
                        {signin.label || '口令'}
                      </span>
                      <span className="block text-base font-bold text-orange-300 tracking-[0.15em]">
                        {signin.passcode}
                      </span>
                    </>
                  ) : (
                    <span className="block text-[11px] text-zinc-400 truncate">{signin.label}</span>
                  )}
                  <a
                    href={signin.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 mt-1 text-[10px] font-bold text-orange-300 underline underline-offset-4 hover:text-orange-200 smooth-transition"
                  >
                    <ExternalLink size={10} />
                    <span>打开签到页</span>
                  </a>
                </span>
                <div className="bg-white p-1.5 rounded-[var(--radius-sm)] shrink-0">
                  <QRCodeSVG value={signin.url} size={72} level="M" />
                </div>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onSelectFunction('signin')}
              className="w-full flex items-center gap-2 px-3 py-2 mt-1.5 rounded-[var(--radius-sm)] border border-dashed border-zinc-800 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60 smooth-transition"
            >
              <QrCode size={13} className="shrink-0" />
              <span className="text-left">尚未设置签到链接，点击添加</span>
            </button>
          )
        )}
      </div>
    </aside>
  )
}
