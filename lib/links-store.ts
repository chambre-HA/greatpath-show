import type { ShowLink } from '@/types'

function detectKind(url: string): ShowLink['kind'] | null {
  const haystack = decodeURIComponent(url).toLowerCase()
  if (/\.pdf(\b|$)/.test(haystack)) return 'pdf'
  if (/\.pptx?(\b|$)/.test(haystack)) return 'ppt'
  if (/1drv\.ms\/p\//.test(haystack)) return 'ppt'
  if (/1drv\.ms\/b\//.test(haystack)) return 'pdf'
  if (/docs\.google\.com\/presentation\//.test(haystack)) return 'ppt'
  if (/view\.officeapps\.live\.com\/op\/embed/.test(haystack)) return 'ppt'
  if (/onedrive\.live\.com\/embed/.test(haystack)) return 'ppt'
  return null
}

export function validateLinkInput(url: string): { ok: true; kind: ShowLink['kind'] } | { ok: false; reason: string } {
  try {
    new URL(url)
  } catch {
    return { ok: false, reason: 'Not a valid URL' }
  }
  const kind = detectKind(url)
  if (!kind) return { ok: false, reason: 'URL must reference a .pdf, .ppt, or .pptx file' }
  return { ok: true, kind }
}

export function makeLink(title: string, url: string, kind: ShowLink['kind']): ShowLink {
  return {
    id: crypto.randomUUID(),
    title: title.trim() || url.split('/').pop() || 'Untitled',
    url: url.trim(),
    kind,
    addedAt: new Date().toISOString(),
  }
}

interface LinkStore {
  list(): Promise<ShowLink[]>
  add(link: ShowLink): Promise<void>
  remove(id: string): Promise<void>
}

export function getStore(classCode: string): LinkStore {
  return {
    async list() {
      const res = await fetch(`/api/links?class=${encodeURIComponent(classCode)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`)
      return (await res.json()) as ShowLink[]
    },
    async add(link) {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', class: classCode, link }),
      })
      if (!res.ok) {
        const msg = await res.text().catch(() => '')
        throw new Error(`Add failed: ${res.status} ${msg}`)
      }
    },
    async remove(id) {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', class: classCode, id }),
      })
      if (!res.ok) throw new Error(`Remove failed: ${res.status}`)
    },
  }
}
