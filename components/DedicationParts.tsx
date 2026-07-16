'use client'

import { useState } from 'react'
import { Pause, Play, Trash2, X } from 'lucide-react'
import type { DedicationGroup, DedicationPerson } from '@/types'

export function PersonChip({ person, busy, onTogglePause, onRemove }: {
  person: DedicationPerson
  busy: boolean
  onTogglePause: () => void
  onRemove: () => void
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-xl text-sm border smooth-transition ${
      person.paused
        ? 'border-slate-850 bg-slate-900/50 text-slate-550 line-through'
        : 'border-slate-800 bg-slate-900 text-slate-200 shadow-sm'
    }`}>
      <span className="font-medium">{person.name}</span>
      <div className="flex items-center gap-0.5 border-l border-slate-800 pl-1.5 py-0.5 ml-1">
        <button
          onClick={onTogglePause}
          disabled={busy}
          className={`p-1 rounded-lg smooth-transition ${
            person.paused
              ? 'text-emerald-500 hover:bg-emerald-950/40'
              : 'text-amber-500 hover:bg-amber-950/40'
          }`}
          title={person.paused ? '恢复本周' : '本周暂停'}
        >
          {person.paused ? <Play size={12} /> : <Pause size={12} />}
        </button>
        <button
          onClick={onRemove}
          disabled={busy}
          className="p-1 rounded-lg text-rose-500 hover:bg-rose-950/40 smooth-transition"
          title="移除"
        >
          <X size={12} />
        </button>
      </div>
    </span>
  )
}

export function AddPersonInput({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
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
      className="inline-flex items-center"
    >
      <input
        type="text"
        placeholder="+ 姓名"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={submit}
        disabled={busy}
        className="w-20 px-2.5 py-1 text-xs rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/80 transition-all smooth-transition"
      />
    </form>
  )
}

export function GroupCard({ group, busyId, onUpdatePurpose, onRemoveGroup, onAddPerson, onTogglePause, onRemovePerson }: {
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
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl hover:border-slate-750 smooth-transition">
      <div className="flex items-start justify-between gap-4">
        {editing ? (
          <input
            autoFocus
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
            className="flex-1 px-3 py-1.5 text-sm rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 transition-all"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 text-left text-base font-semibold text-slate-100 hover:text-emerald-400 smooth-transition"
          >
            {group.purpose || <span className="text-slate-600 italic">点击设置回向类型...</span>}
          </button>
        )}
        <button
          onClick={() => onRemoveGroup(group)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-950/20 smooth-transition shrink-0"
          title="删除此分类"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
