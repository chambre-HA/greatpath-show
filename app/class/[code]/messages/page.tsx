'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Check, ChevronDown, Copy, Pencil, Plus,
  Save, Trash2, X,
} from 'lucide-react'
import type { MessageTeam, MessageTemplate } from '@/types'

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiGet(classCode: string): Promise<MessageTemplate[]> {
  const res = await fetch(`/api/messages?class=${encodeURIComponent(classCode)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Load failed: ${res.status}`)
  return res.json()
}

async function apiPost(classCode: string, body: object): Promise<void> {
  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ class: classCode, ...body }),
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
}

function makeTemplate(title: string, body: string, team: MessageTeam): MessageTemplate {
  return { id: crypto.randomUUID(), title: title.trim() || 'Untitled', body, team, addedAt: new Date().toISOString() }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TEAMS: { value: MessageTeam; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: '1', label: '第一组' },
  { value: '2', label: '第二组' },
  { value: '3', label: '第三组' },
]

const TEAM_COLORS: Record<MessageTeam, string> = {
  all: 'bg-gray-700 text-gray-300',
  '1': 'bg-blue-900/60 text-blue-300',
  '2': 'bg-violet-900/60 text-violet-300',
  '3': 'bg-emerald-900/60 text-emerald-300',
}

// ── Add / Edit form ───────────────────────────────────────────────────────────

interface TemplateFormProps {
  initial?: MessageTemplate
  onSave: (t: MessageTemplate) => Promise<void>
  onCancel: () => void
}

function TemplateForm({ initial, onSave, onCancel }: TemplateFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [team, setTeam] = useState<MessageTeam>(initial?.team ?? 'all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bodyRef.current?.focus() }, [])

  async function handleSave() {
    if (!body.trim()) { setError('Message body cannot be empty'); return }
    setBusy(true)
    setError(null)
    try {
      const next: MessageTemplate = initial
        ? { ...initial, title: title.trim() || 'Untitled', body: body.trim(), team }
        : makeTemplate(title, body.trim(), team)
      await onSave(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 space-y-3">
      <input
        type="text"
        placeholder="标题（选填）"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-500"
      />
      <textarea
        ref={bodyRef}
        placeholder="消息内容…"
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={5}
        className="w-full px-3 py-2 text-sm rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-500 resize-none leading-relaxed"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 shrink-0">小组：</span>
        <div className="flex gap-1">
          {TEAMS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTeam(t.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                team === t.value ? TEAM_COLORS[t.value] + ' ring-1 ring-inset ring-white/20' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-300">取消</button>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !body.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-900 text-sm font-medium hover:bg-white disabled:opacity-40"
        >
          <Save size={13} /> {busy ? '保存中…' : '保存'}
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
}

function TemplateCard({ template, onEdit, onDelete }: CardProps) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const isLong = template.body.length > 160

  function handleCopy() {
    navigator.clipboard.writeText(template.body).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const teamMeta = TEAMS.find(t => t.value === template.team)

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-100 truncate">{template.title}</h3>
            {template.team !== 'all' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TEAM_COLORS[template.team]}`}>
                {teamMeta?.label}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            title="编辑"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(template.id)}
            className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800"
            title="删除"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="relative">
        <p className={`text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
          {template.body}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 mt-1 text-[11px] text-gray-500 hover:text-gray-400"
          >
            <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? '收起' : '展开'}
          </button>
        )}
      </div>

      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
          copied
            ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800'
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-transparent'
        }`}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? '已复制！' : '复制'}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const params = useParams()
  const classCode = params.code as string
  const router = useRouter()

  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<MessageTeam | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiGet(classCode)
      setTemplates(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
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
    if (!confirm('确定删除此模板？')) return
    await apiPost(classCode, { action: 'remove', id })
    await load()
  }

  const visible = filter === 'all'
    ? templates
    : templates.filter(t => t.team === filter || t.team === 'all')

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push(`/class/${classCode}`)}
          className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"
          aria-label="返回"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-white leading-tight">消息模板</h1>
          <p className="text-[11px] text-gray-600 font-mono">{classCode}</p>
        </div>
        <button
          onClick={() => { setAdding(v => !v); setEditingTemplate(null) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            adding ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-900 hover:bg-white'
          }`}
        >
          {adding ? <X size={14} /> : <Plus size={14} />}
          {adding ? '取消' : '新增'}
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Add form */}
        {adding && (
          <TemplateForm onSave={handleAdd} onCancel={() => setAdding(false)} />
        )}

        {/* Team filter */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TEAMS.map(t => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === t.value
                  ? t.value === 'all' ? 'bg-gray-700 text-white' : TEAM_COLORS[t.value] + ' ring-1 ring-inset ring-white/10'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
              }`}
            >
              {t.label}
              {t.value !== 'all' && (
                <span className="ml-1.5 text-[10px] opacity-60">
                  {templates.filter(m => m.team === t.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <p className="text-sm text-gray-500 text-center py-12">加载中…</p>
        )}
        {error && (
          <p className="text-sm text-red-400 text-center py-6">{error}</p>
        )}
        {!loading && !error && visible.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <p className="text-gray-500 text-sm">暂无消息模板</p>
            <button
              onClick={() => setAdding(true)}
              className="text-sm text-gray-600 hover:text-gray-400 underline underline-offset-2"
            >
              添加第一个
            </button>
          </div>
        )}
        {!loading && !error && (
          <div className="space-y-3">
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
                />
              )
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
