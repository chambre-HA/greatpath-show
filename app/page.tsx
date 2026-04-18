'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/classes?code=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!data.valid) {
        setError('Invalid class code. Please check and try again.')
        setLoading(false)
        return
      }
      router.push(`/class/${trimmed}`)
    } catch {
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">共修平台</h1>
          <p className="text-sm text-gray-500">请输入班级码以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="7位班级码"
            autoFocus
            className="w-full px-4 py-3 text-center text-xl font-mono tracking-widest rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
          {error && <p className="text-xs text-red-400 text-center">班级码无效，请重新输入。</p>}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3 rounded-lg bg-gray-100 text-gray-900 font-semibold hover:bg-white disabled:opacity-40 transition"
          >
            {loading ? '验证中…' : '进入'}
          </button>
        </form>

        <p className="text-center">
          <a href="/admin" className="text-xs text-gray-700 hover:text-gray-500 transition">
            管理
          </a>
        </p>
      </div>
    </main>
  )
}
