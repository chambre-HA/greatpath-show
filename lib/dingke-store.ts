import type { DingkeSection } from '@/types'

export interface DingkeScript {
  sections: DingkeSection[]
  /** Section ids this class has edited — drives the 「已修改」badge and reset. */
  overriddenIds: string[]
}

export interface DingkeSectionEdit {
  title: string
  subtitle: string
  headline: string
  slideLines: string[]
  body: string
}

export function getDingkeStore(classCode: string) {
  async function post(body: object) {
    const res = await fetch('/api/dingke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class: classCode, ...body }),
    })
    if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  }

  return {
    async load(): Promise<DingkeScript> {
      const res = await fetch(`/api/dingke?class=${encodeURIComponent(classCode)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`)
      return (await res.json()) as DingkeScript
    },
    save: (sectionId: string, edit: DingkeSectionEdit) => post({ action: 'save', sectionId, ...edit }),
    reset: (sectionId: string) => post({ action: 'reset', sectionId }),
  }
}
