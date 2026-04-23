'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Viewer } from '@/components/Viewer'
import { getStore } from '@/lib/links-store'
import type { ClassInfo, ShowLink } from '@/types'

export default function ClassPage() {
  const params = useParams()
  const classCode = params.code as string
  const router = useRouter()
  const [links, setLinks] = useState<ShowLink[]>([])
  const [openTabIds, setOpenTabIds] = useState<string[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)
  const initializedRef = useRef(false)

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

  // Restore last-active tab once links are loaded
  useEffect(() => {
    if (initializedRef.current || links.length === 0) return
    initializedRef.current = true
    const saved = window.localStorage.getItem(`greatpath-show:${classCode}:selected`)
    if (saved && links.find(l => l.id === saved)) {
      setOpenTabIds([saved])
      setActiveTabId(saved)
    }
  }, [links, classCode])

  useEffect(() => {
    let cancelled = false
    async function loadClassInfo() {
      try {
        const res = await fetch(`/api/classes?code=${encodeURIComponent(classCode)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Failed to load class: ${res.status}`)
        const data = await res.json()
        if (!cancelled) setClassInfo(data.class ?? null)
      } catch (e) {
        console.error('Failed to load class info', e)
        if (!cancelled) setClassInfo(null)
      }
    }
    loadClassInfo()
    return () => { cancelled = true }
  }, [classCode])

  useEffect(() => {
    const key = `greatpath-show:${classCode}:selected`
    if (activeTabId) window.localStorage.setItem(key, activeTabId)
    else window.localStorage.removeItem(key)
  }, [activeTabId, classCode])

  const handleSelect = useCallback((id: string) => {
    setOpenTabIds(prev => prev.includes(id) ? prev : [...prev, id])
    setActiveTabId(id)
  }, [])

  const handleCloseTab = useCallback((id: string) => {
    setOpenTabIds(prev => {
      const next = prev.filter(t => t !== id)
      setActiveTabId(cur => {
        if (cur !== id) return cur
        const idx = prev.indexOf(id)
        return next[idx] ?? next[idx - 1] ?? null
      })
      return next
    })
  }, [])

  const handleAdd = async (link: ShowLink) => {
    await getStore(classCode).add(link)
    await refresh()
    handleSelect(link.id)
  }

  const handleRemove = async (id: string) => {
    await getStore(classCode).remove(id)
    handleCloseTab(id)
    await refresh()
  }

  return (
    <main className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <Sidebar
        classCode={classCode}
        className={classInfo?.name || classCode}
        links={links}
        selectedId={activeTabId}
        onSelect={handleSelect}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onBack={() => router.push('/')}
      />
      <Viewer
        links={links}
        openTabIds={openTabIds}
        activeTabId={activeTabId}
        onActivate={handleSelect}
        onClose={handleCloseTab}
      />
    </main>
  )
}
