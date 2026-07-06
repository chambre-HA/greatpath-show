'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, Copy, MessageSquare, Pause, Play, Plus, Trash2, X } from 'lucide-react'
import { getDedicationStore, makeDedicationGroup, makeDedicationPerson } from '@/lib/dedication-store'
import type { ClassInfo, DedicationGroup, DedicationPerson } from '@/types'

function PersonChip({ person, busy, onTogglePause, onRemove }: {
  person: DedicationPerson
  busy: boolean
  onTogglePause: () => void
  onRemove: () => void
}) {
  return (
    <span className={`group inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm border ${
      person.paused ? 'border-gray-800 bg-gray-900 text-gray-500 line-through' : 'border-gray-700 bg-gray-800 text-gray-100'
    }`}>
      {person.name}
      <button
        onClick={onTogglePause}
        disabled={busy}
        className="p-1 rounded text-amber-400 hover:bg-amber-400/10 disabled:opacity-30"
        title={person.paused ? '恢复本周' : '本周暂停'}
      >
        {person.paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
      <button
        onClick={onRemove}
        disabled={busy}
        className="p-1 rounded text-red-400 hover:bg-red-400/10 disabled:opacity-30"
        title="移除"
      >
        <X size={14} />
      </button>
    </span>
  )
}

function AddPersonInput({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    const name = value.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      await onAdd(name)
      setValue('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); submit() }}
      className="inline-flex items-center gap-1"
    >
      <input
        type="text"
        placeholder="+ 添加姓名"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={submit}
        disabled={busy}
        className="w-32 px-2.5 py-1.5 text-sm rounded-full bg-gray-950 border border-dashed border-gray-700 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
      />
    </form>
  )
}

function GroupCard({ group, busyId, onUpdatePurpose, onRemoveGroup, onAddPerson, onTogglePause, onRemovePerson }: {
  group: DedicationGroup
  busyId: string | null
  onUpdatePurpose: (group: DedicationGroup, purpose: string) => void
  onRemoveGroup: (group: DedicationGroup) => void
  onAddPerson: (group: DedicationGroup, name: string) => Promise<void>
  onTogglePause: (group: DedicationGroup, person: DedicationPerson) => void
  onRemovePerson: (group: DedicationGroup, person: DedicationPerson) => void
}) {
  const [editing, setEditing] = useState(false)
  const [purpose, setPurpose] = useState(group.purpose)

  function save() {
    setEditing(false)
    if (purpose.trim() && purpose.trim() !== group.purpose) onUpdatePurpose(group, purpose.trim())
    else setPurpose(group.purpose)
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3 group/card">
      <div className="flex items-start gap-2">
        {editing ? (
          <input
            autoFocus
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
            className="flex-1 px-2 py-1 text-base rounded bg-gray-950 border border-gray-700 text-gray-100 focus:outline-none focus:border-gray-500"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="flex-1 text-left text-base text-gray-200 hover:text-white">
            {group.purpose || <span className="text-gray-600 italic">点击设置回向内容…</span>}
          </button>
        )}
        <button
          onClick={() => onRemoveGroup(group)}
          className="p-1 rounded text-red-400 hover:bg-red-400/10 opacity-0 group-hover/card:opacity-100"
          title="删除此项"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {group.people.map(person => (
          <PersonChip
            key={person.id}
            person={person}
            busy={busyId === person.id}
            onTogglePause={() => onTogglePause(group, person)}
            onRemove={() => onRemovePerson(group, person)}
          />
        ))}
        <AddPersonInput onAdd={name => onAddPerson(group, name)} />
      </div>
    </div>
  )
}

export default function DedicationPage() {
  const params = useParams()
  const classCode = params.code as string
  const router = useRouter()
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const [groups, setGroups] = useState<DedicationGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newPurpose, setNewPurpose] = useState('')
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)

  const store = getDedicationStore(classCode)

  const refresh = useCallback(async () => {
    try {
      const items = await store.list()
      setGroups(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classCode])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/classes?code=${encodeURIComponent(classCode)}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => { if (!cancelled) setClassInfo(data.class ?? null) })
      .catch(() => { if (!cancelled) setClassInfo(null) })
    return () => { cancelled = true }
  }, [classCode])

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault()
    const purpose = newPurpose.trim()
    if (!purpose) return
    const existing = groups.find(g => g.purpose.trim().toLowerCase() === purpose.toLowerCase())
    if (existing) {
      setError(`「${purpose}」已存在，请直接在下方名单中添加姓名`)
      return
    }
    setAdding(true)
    setError(null)
    try {
      await store.addGroup(makeDedicationGroup(purpose))
      setNewPurpose('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  async function handleUpdatePurpose(group: DedicationGroup, purpose: string) {
    setBusyId(group.id)
    try {
      await store.updateGroupPurpose(group.id, purpose)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemoveGroup(group: DedicationGroup) {
    setBusyId(group.id)
    try {
      await store.removeGroup(group.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleAddPerson(group: DedicationGroup, name: string) {
    try {
      await store.addPerson(group.id, makeDedicationPerson(name, 'self'))
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  async function handleTogglePause(group: DedicationGroup, person: DedicationPerson) {
    setBusyId(person.id)
    try {
      await store.togglePause(group.id, person.id, !person.paused)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemovePerson(group: DedicationGroup, person: DedicationPerson) {
    setBusyId(person.id)
    try {
      await store.removePerson(group.id, person.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCopy() {
    const blocks = groups
      .map(g => ({ ...g, people: g.people.filter(p => !p.paused) }))
      .filter(g => g.people.length > 0)
      .map((g, i) => `${i + 1}. 祝愿\n${g.people.map(p => p.name).join('，')}\n${g.purpose}`)
    await navigator.clipboard.writeText(blocks.join('\n\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const hasActive = groups.some(g => g.people.some(p => !p.paused))

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-950/95 backdrop-blur px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push(`/class/${classCode}`)}
          className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"
          aria-label="返回"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-white leading-tight">回向名单</h1>
          <p className="text-[11px] text-gray-600 truncate">{classInfo?.name || classCode}</p>
        </div>
        <a
          href={`/class/${classCode}/messages`}
          className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800"
          title="消息模板"
        >
          <MessageSquare size={16} />
        </a>
        <button
          onClick={handleCopy}
          disabled={!hasActive}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-900 font-medium hover:bg-white disabled:opacity-40"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? '已复制' : '复制本周名单'}
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {error && <p className="text-xs text-red-400">{error}</p>}

        {loading ? (
          <p className="text-xs text-gray-500 text-center py-6">加载中…</p>
        ) : groups.length === 0 ? (
          <p className="text-xs text-gray-600 italic text-center py-6">暂无名单，请先添加。</p>
        ) : (
          <div className="space-y-3">
            {groups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                busyId={busyId}
                onUpdatePurpose={handleUpdatePurpose}
                onRemoveGroup={handleRemoveGroup}
                onAddPerson={handleAddPerson}
                onTogglePause={handleTogglePause}
                onRemovePerson={handleRemovePerson}
              />
            ))}
          </div>
        )}

        <form onSubmit={handleAddGroup} className="flex gap-2 p-3 rounded-lg bg-gray-900 border border-gray-800">
          <input
            type="text"
            list="dedication-purposes"
            placeholder="新增回向类型（例如：早日康复，病障远离）"
            value={newPurpose}
            onChange={e => setNewPurpose(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 text-sm rounded bg-gray-950 border border-gray-700 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
          <datalist id="dedication-purposes">
            {groups.map(g => <option key={g.id} value={g.purpose} />)}
          </datalist>
          <button
            type="submit"
            disabled={adding || !newPurpose.trim()}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded bg-gray-100 text-gray-900 font-medium hover:bg-white disabled:opacity-40 shrink-0"
          >
            <Plus size={14} /> {adding ? '添加中…' : '添加'}
          </button>
        </form>
      </div>
    </main>
  )
}
