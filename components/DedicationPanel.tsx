'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Menu, Plus } from 'lucide-react'
import { getDedicationStore, makeDedicationGroup, makeDedicationPerson } from '@/lib/dedication-store'
import { GroupCard } from './DedicationParts'
import type { DedicationGroup } from '@/types'

export function DedicationPanel({ classCode, onToggleSidebar }: { classCode: string; onToggleSidebar?: () => void }) {
  const [groups, setGroups] = useState<DedicationGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newPurpose, setNewPurpose] = useState('')
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const store = getDedicationStore(classCode)

  const refresh = useCallback(async () => {
    try {
      const items = await store.list()
      setGroups(items)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classCode])

  useEffect(() => { refresh() }, [refresh])

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
      setError(e instanceof Error ? e.message : '添加失败')
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
      setError(e instanceof Error ? e.message : '更新失败')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemoveGroup(group: DedicationGroup) {
    if (!confirm(`确定删除「${group.purpose}」分类？分类下的所有人员都将被删除。`)) return
    setBusyId(group.id)
    try {
      await store.removeGroup(group.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setBusyId(null)
    }
  }

  async function handleAddPerson(group: DedicationGroup, name: string) {
    try {
      await store.addPerson(group.id, makeDedicationPerson(name, 'self'))
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加姓名失败')
    }
  }

  async function handleTogglePause(group: DedicationGroup, person: import('@/types').DedicationPerson) {
    setBusyId(person.id)
    try {
      await store.togglePause(group.id, person.id, !person.paused)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemovePerson(group: DedicationGroup, person: import('@/types').DedicationPerson) {
    setBusyId(person.id)
    try {
      await store.removePerson(group.id, person.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '移除失败')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCopy() {
    const blocks = groups
      .map(g => ({ ...g, people: g.people.filter(p => !p.paused) }))
      .filter(g => g.people.length > 0)
      .map((g, i) => `${i + 1}. 祝愿\n${g.people.map(p => p.name).join('，')}\n${g.purpose}`)

    if (blocks.length === 0) return

    await navigator.clipboard.writeText(blocks.join('\n\n'))
    setCopied(true)
    setToastMsg('回向名单已成功复制到剪贴板！')
    setTimeout(() => {
      setCopied(false)
      setToastMsg(null)
    }, 2000)
  }

  const hasActive = groups.some(g => g.people.some(p => !p.paused))

  return (
    <div className="flex-1 flex flex-col bg-gray-900 min-w-0 min-h-0 overflow-y-auto premium-glow-bg relative">
      <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-pink-500/5 blur-[100px] pointer-events-none" />

      {/* Panel toolbar */}
      <header className="sticky top-0 z-30 border-b border-gray-800/80 bg-gray-950/80 backdrop-blur px-4 py-3.5 flex items-center gap-3 shrink-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 -ml-1.5 text-gray-400 hover:text-white md:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={18} />
          </button>
        )}
        <h1 className="flex-1 text-sm font-bold text-white leading-tight">回向名单</h1>
        <button
          onClick={handleCopy}
          disabled={!hasActive}
          className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all duration-250"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? '已复制' : '复制本周名单'}</span>
        </button>
      </header>

      <div className="max-w-2xl w-full mx-auto px-4 py-8 space-y-6 relative z-10">
        {error && (
          <p className="text-xs text-rose-400 bg-rose-950/20 py-2 px-4 rounded-xl border border-rose-900/30">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-sm gap-2">
            <svg className="animate-spin h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>加载名单中...</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 glass-panel rounded-2xl border border-slate-800/80 p-8">
            <p className="text-slate-400 text-sm italic">暂无名单，请在下方新增回向类型并添加姓名。</p>
          </div>
        ) : (
          <div className="space-y-4">
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

        <form onSubmit={handleAddGroup} className="flex gap-2 p-4 rounded-2xl glass-panel border border-slate-850 shadow-xl bg-slate-900/35">
          <input
            type="text"
            list="dedication-purposes"
            placeholder="新增回向类型（如：早日康复、高考顺利）"
            value={newPurpose}
            onChange={e => setNewPurpose(e.target.value)}
            className="flex-1 min-w-0 px-3.5 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/80 transition-all smooth-transition"
          />
          <datalist id="dedication-purposes">
            {groups.map(g => <option key={g.id} value={g.purpose} />)}
          </datalist>

          <button
            type="submit"
            disabled={adding || !newPurpose.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs rounded-xl bg-slate-100 text-slate-900 font-bold hover:bg-white active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200 shrink-0"
          >
            <Plus size={14} />
            <span>{adding ? '添加中...' : '添加'}</span>
          </button>
        </form>
      </div>

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl glass-panel border border-emerald-500/30 text-white text-xs font-semibold shadow-2xl flex items-center gap-2">
          <Check size={14} className="text-emerald-400 animate-scale-up" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}
