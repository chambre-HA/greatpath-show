'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Menu, Plus, X } from 'lucide-react'
import { apiGet, apiPost, TEAMS, TemplateCard, TemplateForm } from './MessageParts'
import type { MessageTeam, MessageTemplate } from '@/types'

export function MessagesPanel({ classCode, onToggleSidebar }: { classCode: string; onToggleSidebar?: () => void }) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<MessageTeam | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiGet(classCode)
      setTemplates(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [classCode])

  useEffect(() => { load() }, [load])

  async function handleAdd(t: MessageTemplate) {
    await apiPost(classCode, { action: 'add', message: t })
    setAdding(false)
    await load()
  }

  async function handleUpdate(t: MessageTemplate) {
    await apiPost(classCode, { action: 'update', message: t })
    setEditingTemplate(null)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除此消息模板？')) return
    await apiPost(classCode, { action: 'remove', id })
    await load()
  }

  const handleCopySuccess = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2000)
  }

  const visible = filter === 'all'
    ? templates
    : templates.filter(t => t.team === filter || t.team === 'all')

  return (
    <div className="flex-1 flex flex-col bg-zinc-900 min-w-0 min-h-0 overflow-y-auto premium-glow-bg relative">

      {/* Panel toolbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur px-4 py-3.5 flex items-center gap-3 shrink-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 -ml-1.5 text-zinc-400 hover:text-white md:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
        )}
        <h1 className="flex-1 text-sm font-bold text-white leading-tight">消息模板</h1>
        <button
          onClick={() => { setAdding(v => !v); setEditingTemplate(null) }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-[var(--radius-sm)] text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
            adding
              ? 'bg-zinc-800 border border-zinc-700 text-zinc-300'
              : 'bg-orange-600 hover:bg-orange-500 text-white'
          }`}
        >
          {adding ? <X size={13} /> : <Plus size={13} />}
          <span>{adding ? '取消' : '新增模板'}</span>
        </button>
      </header>

      <div className="max-w-2xl w-full mx-auto px-4 py-8 space-y-6 relative z-10">
        {adding && (
          <TemplateForm onSave={handleAdd} onCancel={() => setAdding(false)} />
        )}

        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
          {TEAMS.map(t => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`shrink-0 px-4 py-2 rounded-[var(--radius-sm)] text-xs font-semibold border smooth-transition active:scale-[0.97] ${
                filter === t.value
                  ? 'bg-orange-500/12 text-orange-300 border-orange-500/40 font-bold'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              <span>{t.label}</span>
              {t.value !== 'all' && (
                <span className="ml-1.5 text-[10px] opacity-70 bg-black/30 px-1.5 py-0.5 rounded-[var(--radius-sm)] font-mono">
                  {templates.filter(m => m.team === t.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm gap-2">
            <svg className="animate-spin h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>正在载入模板...</span>
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-400 bg-rose-950/20 py-2 px-4 rounded-[var(--radius-sm)] border border-rose-900/30">
            {error}
          </p>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="text-center py-16 bg-zinc-900/40 rounded-[var(--radius-md)] border border-zinc-800 p-8 space-y-3">
            <p className="text-zinc-400 text-sm">此分组下暂无可用消息模板</p>
            <button
              onClick={() => setAdding(true)}
              className="text-xs text-orange-400 hover:text-orange-300 font-bold underline underline-offset-4"
            >
              点击添加第一个模板
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            {visible.map(t => (
              editingTemplate?.id === t.id ? (
                <TemplateForm
                  key={t.id}
                  initial={t}
                  onSave={handleUpdate}
                  onCancel={() => setEditingTemplate(null)}
                />
              ) : (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onEdit={setEditingTemplate}
                  onDelete={handleDelete}
                  onCopySuccess={handleCopySuccess}
                />
              )
            ))}
          </div>
        )}
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-[var(--radius-sm)] bg-zinc-900 border border-orange-500/30 text-white text-xs font-semibold shadow-2xl flex items-center gap-2">
          <Check size={14} className="text-orange-400 animate-scale-up" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}
