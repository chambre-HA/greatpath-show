'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, HeartHandshake } from 'lucide-react'
import { MessagesPanel } from '@/components/MessagesPanel'

export default function MessagesPage() {
  const params = useParams()
  const classCode = params.code as string
  const router = useRouter()

  return (
    <main className="flex h-screen bg-zinc-900 text-zinc-100 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-950 shrink-0">
          <button
            onClick={() => router.push(`/class/${classCode}`)}
            className="p-2 rounded-[var(--radius-sm)] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 smooth-transition"
            aria-label="返回"
          >
            <ArrowLeft size={16} />
          </button>
          <p className="flex-1 text-[11px] text-zinc-500 font-mono tracking-wider">{classCode}</p>
          <a
            href={`/class/${classCode}/dedication`}
            className="p-2 rounded-[var(--radius-sm)] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 smooth-transition"
            title="回向名单"
          >
            <HeartHandshake size={16} />
          </a>
        </header>
        <MessagesPanel classCode={classCode} />
      </div>
    </main>
  )
}
