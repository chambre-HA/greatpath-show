'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, Pencil, Save, Trash2 } from 'lucide-react'
import type { MessageTeam, MessageTemplate } from '@/types'

// ── API helpers ───────────────────────────────────────────────────────────────

export async function apiGet(classCode: string): Promise<MessageTemplate[]> {
  const res = await fetch(`/api/messages?class=${encodeURIComponent(classCode)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`加载模板失败: ${res.status}`)
  return res.json()
}

export async function apiPost(classCode: string, body: object): Promise<void> {
  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ class: classCode, ...body }),
  })
  if (!res.ok) throw new Error(`操作失败: ${res.status}`)
}

export function makeTemplate(title: string, body: string, team: MessageTeam): MessageTemplate {
  return { id: crypto.randomUUID(), title: title.trim() || '未命名模板', body, team, addedAt: new Date().toISOString() }
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const TEAMS: { value: MessageTeam; label: string }[] = [
  { value: 'all', label: '全部组' },
  { value: '1', label: '第一组' },
  { value: '2', label: '第二组' },
  { value: '3', label: '第三组' },
]

export const TEAM_COLORS: Record<MessageTeam, string> = {
  all: 'bg-slate-800 text-slate-350 border-slate-700',
  '1': 'bg-blue-950/40 text-blue-400 border-blue-900/30',
  '2': 'bg-teal-950/40 text-teal-400 border-teal-900/30',
  '3': 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30',
}

// ── Add / Edit form ───────────────────────────────────────────────────────────

interface TemplateFormProps {
  initial?: MessageTemplate
  onSave: (t: MessageTemplate) => Promise<void>
  onCancel: () => void
}

export function TemplateForm({ initial, onSave, onCancel }: TemplateFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [team, setTeam] = useState<MessageTeam>(initial?.team ?? 'all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bodyRef.current?.focus() }, [])

  async function handleSave() {
    if (!body.trim()) { setError('消息内容不能为空'); return }
    setBusy(true)
    setError(null)
    try {
      const next: MessageTemplate = initial
        ? { ...initial, title: title.trim() || '未命名模板', body: body.trim(), team }
        : makeTemplate(title, body.trim(), team)
      await onSave(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-5 space-y-4 shadow-xl">
      <h3 className="text-sm font-bold text-white mb-1">{initial ? '编辑模板' : '创建新模板'}</h3>
      <input
        type="text"
        placeholder="模板标题（如：共修提醒、日常签到）"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-650 focus:outline-none focus:border-emerald-500 transition-all smooth-transition"
      />
      <textarea
        ref={bodyRef}
        placeholder="在此输入需要复制的消息模板内容..."
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={6}
        className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-655 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed transition-all smooth-transition"
      />
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 font-semibold tracking-wider">分配小组:</span>
        <div className="flex flex-wrap gap-1.5">
          {TEAMS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTeam(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border smooth-transition ${
                team === t.value
                  ? 'bg-emerald-600/15 text-emerald-400 border-emerald-500/40'
                  : 'border-slate-850 text-slate-500 hover:text-slate-350 hover:bg-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="text-xs text-rose-450 bg-rose-950/20 py-1.5 px-3 rounded-lg border border-rose-900/30">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-slate-500 hover:text-slate-300 smooth-transition"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !body.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all duration-200"
        >
          <Save size={13} />
          <span>{busy ? '正在保存...' : '保存模板'}</span>
        </button>
      </div>
    </div>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────

interface CardProps {
  template: MessageTemplate
  onEdit: (t: MessageTemplate) => void
  onDelete: (id: string) => void
  onCopySuccess: (msg: string) => void
}

export function TemplateCard({ template, onEdit, onDelete, onCopySuccess }: CardProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const isLong = template.body.length > 160

  function handleCopy() {
    navigator.clipboard.writeText(template.body).then(() => {
      setCopied(true)
      onCopySuccess('消息模板已成功复制！')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const teamMeta = TEAMS.find(t => t.value === template.team)

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4 group/card hover:border-slate-750 smooth-transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-sm font-bold text-slate-100 truncate">{template.title}</h3>
            {template.team !== 'all' && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${TEAM_COLORS[template.team]}`}>
                {teamMeta?.label}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-900/60 smooth-transition"
            title="编辑"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-955/20 smooth-transition"
            title="删除"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="relative">
        <p className={`text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
          {template.body}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 mt-2 text-[10px] text-slate-500 hover:text-emerald-400 smooth-transition font-bold uppercase tracking-wider"
          >
            <ChevronDown size={12} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            <span>{expanded ? '折叠内容' : '展开全文'}</span>
          </button>
        )}
      </div>

      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 active:scale-[0.98] ${
          copied
            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 shadow-md shadow-emerald-950/10'
            : 'bg-slate-950 text-slate-350 hover:bg-slate-900 hover:text-white border border-slate-850'
        }`}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span>{copied ? '内容已复制！' : '复制此消息'}</span>
      </button>
    </div>
  )
}
