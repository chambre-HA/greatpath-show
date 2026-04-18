'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Viewer } from '@/components/Viewer'
import { getStore } from '@/lib/links-store'
import type { ShowLink } from '@/types'

export default function ClassPage() {
  const params = useParams()
  const classCode = params.code as string
  const router = useRouter()
  const [links, setLinks] = useState<ShowLink[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const s = window.localStorage.getItem(`greatpath-show:${classCode}:selected`)
    if (s) setSelectedId(s)
  }, [classCode])

  const refresh = useCallback(async () => {
    try {
      const items = await getStore(classCode).list()
      setLinks(items)
    } catch (e) {
      console.error('Failed to load links', e)
      setLinks([])
    }
  }, [classCode])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const key = `greatpath-show:${classCode}:selected`
    if (selectedId) window.localStorage.setItem(key, selectedId)
    else window.localStorage.removeItem(key)
  }, [selectedId, classCode])

  const handleAdd = async (link: ShowLink) => {
    await getStore(classCode).add(link)
    await refresh()
    setSelectedId(link.id)
  }

  const handleRemove = async (id: string) => {
    await getStore(classCode).remove(id)
    if (selectedId === id) setSelectedId(null)
    await refresh()
  }

  const selected = links.find(l => l.id === selectedId) ?? null

  return (
    <main className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <Sidebar
        classCode={classCode}
        links={links}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onBack={() => router.push('/')}
      />
      <Viewer link={selected} />
    </main>
  )
}
