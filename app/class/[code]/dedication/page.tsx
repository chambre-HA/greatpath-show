'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { DedicationPanel } from '@/components/DedicationPanel'
import type { ClassInfo } from '@/types'

export default function DedicationPage() {
  const params = useParams()
  const classCode = params.code as string
  const router = useRouter()
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/classes?code=${encodeURIComponent(classCode)}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => { if (!cancelled) setClassInfo(data.class ?? null) })
      .catch(() => { if (!cancelled) setClassInfo(null) })
    return () => { cancelled = true }
  }, [classCode])

  return (
    <main className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-950 shrink-0">
          <button
            onClick={() => router.push(`/class/${classCode}`)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 smooth-transition"
            aria-label="返回"
          >
            <ArrowLeft size={16} />
          </button>
          <p className="flex-1 text-[11px] text-slate-500 font-medium truncate">{classInfo?.name || classCode}</p>
          <a
            href={`/class/${classCode}/messages`}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 smooth-transition"
            title="消息模板"
          >
            <MessageSquare size={16} />
          </a>
        </header>
        <DedicationPanel classCode={classCode} />
      </div>
    </main>
  )
}
