import type { DedicationGroup, DedicationPerson } from '@/types'

export function makeDedicationPerson(name: string, source: DedicationPerson['source']): DedicationPerson {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    paused: false,
    addedAt: new Date().toISOString(),
    source,
  }
}

export function makeDedicationGroup(purpose: string, firstPerson?: DedicationPerson): DedicationGroup {
  return {
    id: crypto.randomUUID(),
    purpose: purpose.trim(),
    people: firstPerson ? [firstPerson] : [],
    addedAt: new Date().toISOString(),
  }
}

interface DedicationStore {
  list(): Promise<DedicationGroup[]>
  addGroup(group: DedicationGroup): Promise<void>
  updateGroupPurpose(groupId: string, purpose: string): Promise<void>
  removeGroup(groupId: string): Promise<void>
  addPerson(groupId: string, person: DedicationPerson): Promise<void>
  removePerson(groupId: string, personId: string): Promise<void>
  togglePause(groupId: string, personId: string, paused: boolean): Promise<void>
}

export function getDedicationStore(classCode: string): DedicationStore {
  async function post(body: object) {
    const res = await fetch('/api/dedication', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class: classCode, ...body }),
    })
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  }

  return {
    async list() {
      const res = await fetch(`/api/dedication?class=${encodeURIComponent(classCode)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`)
      return (await res.json()) as DedicationGroup[]
    },
    addGroup: group => post({ action: 'addGroup', group }),
    updateGroupPurpose: (groupId, purpose) => post({ action: 'updateGroupPurpose', groupId, purpose }),
    removeGroup: groupId => post({ action: 'removeGroup', groupId }),
    addPerson: (groupId, person) => post({ action: 'addPerson', groupId, person }),
    removePerson: (groupId, personId) => post({ action: 'removePerson', groupId, personId }),
    togglePause: (groupId, personId, paused) => post({ action: 'togglePause', groupId, personId, paused }),
  }
}
