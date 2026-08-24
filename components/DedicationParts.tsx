'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { DedicationGroup, DedicationPerson } from '@/types'

/**
 * A single ink/grey row, not a colorful pill chip: click the name to toggle
 * this week's pause (shown as strike-through + dimmed text, no icon needed
 * for that), and the one grey trash icon removes the person. No pink, no
 * second accent color — the row's only color is the hover state on hover.
 */
export function PersonRow({ person, busy, onTogglePause, onRemove }: {
  person: DedicationPerson
  busy: boolean
  onTogglePause: () => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <button
        onClick={onTogglePause}
        disabled={busy}
        title={person.paused ? '恢复本周' : '点击：本周暂停'}
        className={`flex-1 min-w-0 text-left text-sm smooth-transition ${
          person.paused ? 'text-zinc-500 line-through' : 'text-zinc-200 hover:text-orange-300'
        }`}
      >
        {person.name}
      </button>
      <button
        onClick={onRemove}
        disabled={busy}
        className="p-1 rounded-[var(--radius-sm)] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 smooth-transition shrink-0"
        title="移除"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

export function AddPersonInput({ onAdd, dim }: { onAdd: (name: string) => Promise<void>; dim?: boolean }) {
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
      className={`group flex items-center gap-2 px-3 py-2 smooth-transition ${dim ? 'opacity-60 focus-within:opacity-100' : ''}`}
    >
      <Plus size={13} className="text-zinc-600 shrink-0 group-focus-within:text-orange-400 smooth-transition" />
      <input
        type="text"
        placeholder="新增姓名"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={submit}
        disabled={busy}
        className="flex-1 min-w-0 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
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

  const isEmpty = group.people.length === 0

  return (
    <div className="border border-zinc-800 bg-zinc-900">
      {/* Header sits one tone lighter than its rows, so the group reads as a
          header at a glance, not just another row at a bigger font size. */}
      <div className="flex items-start justify-between gap-4 px-3 py-4 border-b border-zinc-800 bg-zinc-800/40">
        {editing ? (
          <input
            autoFocus
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
            className="flex-1 px-3 py-1.5 text-sm rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-orange-500 transition-all"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 text-left text-base font-bold text-orange-400 hover:text-orange-300 smooth-transition"
          >
            {group.purpose || <span className="text-zinc-600 italic">点击设置回向类型...</span>}
          </button>
        )}
        <button
          onClick={() => onRemoveGroup(group)}
          className="p-1.5 rounded-[var(--radius-sm)] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 smooth-transition shrink-0"
          title="删除此分类"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="divide-y divide-zinc-800">
        {isEmpty ? (
          <p className="px-3 py-2.5 text-sm text-zinc-600 italic">暂无姓名</p>
        ) : (
          group.people.map(person => (
            <PersonRow
              key={person.id}
              person={person}
              busy={busyId === person.id}
              onTogglePause={() => onTogglePause(group, person)}
              onRemove={() => onRemovePerson(group, person)}
            />
          ))
        )}
        <AddPersonInput dim={isEmpty} onAdd={name => onAddPerson(group, name)} />
      </div>
    </div>
  )
}
