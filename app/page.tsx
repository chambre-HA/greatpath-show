'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowRight, History, School, X, Settings } from 'lucide-react'

interface RecentClass {
  code: string
  name: string
  visitedAt: string
}

const CODE_LENGTH = 8

export default function Home() {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [recentClasses, setRecentClasses] = useState<RecentClass[]>([])
  const router = useRouter()
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const autoSubmittedRef = useRef<string | null>(null)

  const code = digits.join('')

  useEffect(() => {
    const key = 'greatpath-show:recent-classes'
    const stored = window.localStorage.getItem(key)
    if (stored) {
      try {
        setRecentClasses(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to parse recent classes', e)
      }
    }
  }, [])

  const saveToHistory = (newClass: { code: string; name: string }) => {
    const key = 'greatpath-show:recent-classes'
    let recent = [...recentClasses]
    recent = recent.filter(c => c.code !== newClass.code)
    recent.unshift({ ...newClass, visitedAt: new Date().toISOString() })
    recent = recent.slice(0, 5)
    setRecentClasses(recent)
    window.localStorage.setItem(key, JSON.stringify(recent))
  }

  const removeFromHistory = (e: React.MouseEvent, codeToRemove: string) => {
    e.stopPropagation()
    const key = 'greatpath-show:recent-classes'
    const next = recentClasses.filter(c => c.code !== codeToRemove)
    setRecentClasses(next)
    window.localStorage.setItem(key, JSON.stringify(next))
  }

  async function handleVerifyAndGo(trimmedCode: string, existingName?: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/classes?code=${encodeURIComponent(trimmedCode)}`)
      const data = await res.json()
      if (!data.valid) {
        setError('Invalid class code. Please check and try again.')
        setLoading(false)
        return
      }

      const className = data.class?.name || existingName || trimmedCode
      saveToHistory({ code: trimmedCode, name: className })
      router.push(`/class/${trimmedCode}`)
    } catch {
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{8}$/.test(code)) {
      setError('Class code must be exactly 8 digits.')
      return
    }
    await handleVerifyAndGo(code)
  }

  // Auto-submit once all 8 digits are filled, once per completed code.
  useEffect(() => {
    if (/^\d{8}$/.test(code) && autoSubmittedRef.current !== code) {
      autoSubmittedRef.current = code
      handleVerifyAndGo(code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  function setDigitAt(index: number, value: string) {
    setDigits(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  function handleDigitChange(index: number, raw: string) {
    setError(null)
    const digit = raw.replace(/\D/g, '').slice(-1)
    setDigitAt(index, digit)
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
      setDigitAt(index - 1, '')
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleDigitPaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '')
    if (!pasted) return
    e.preventDefault()
    setError(null)
    setDigits(prev => {
      const next = [...prev]
      for (let i = 0; i < pasted.length && index + i < CODE_LENGTH; i++) {
        next[index + i] = pasted[i]
      }
      return next
    })
    const lastFilled = Math.min(index + pasted.length, CODE_LENGTH) - 1
    inputRefs.current[lastFilled]?.focus()
  }

  return (
    <main className="min-h-screen premium-glow-bg flex items-center justify-center relative p-4">
      {/* Decorative blurred circles */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-60 h-60 rounded-full bg-teal-500/5 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 z-10">
        {/* Logo and Header */}
        <div className="text-center space-y-3">
          <Image
            src="/gpgb-white.png"
            alt="大道大商"
            width={578}
            height={172}
            priority
            className="mx-auto h-28 w-auto"
          />
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              共修平台
            </h1>
            <p className="text-sm text-slate-400">输入 8 位班级码开启共修之旅</p>
          </div>
        </div>

        {/* Input Card */}
        <div className="glass-panel rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 tracking-wider uppercase">
                班级邀请码
              </label>
              <div className="flex gap-1.5 sm:gap-2">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el }}
                    type="text"
                    value={digit}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(i, e)}
                    onPaste={e => handleDigitPaste(i, e)}
                    autoFocus={i === 0}
                    maxLength={1}
                    inputMode="numeric"
                    aria-label={`Class code digit ${i + 1}`}
                    className={`w-full min-w-0 aspect-square text-center text-2xl font-bold font-mono rounded-xl bg-slate-950/80 border text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all smooth-transition shadow-inner ${
                      error ? 'border-rose-500/60' : 'border-slate-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-400 text-center animate-pulse bg-rose-950/20 py-1.5 rounded-lg border border-rose-900/30">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || code.trim().length !== 8}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>验证中...</span>
                </>
              ) : (
                <>
                  <span>进入班级</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* History / Recent Classes */}
        {recentClasses.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
              <History size={12} />
              <span>最近访问</span>
            </div>
            <div className="space-y-2">
              {recentClasses.map(cls => (
                <div
                  key={cls.code}
                  onClick={() => handleVerifyAndGo(cls.code, cls.name)}
                  className="flex items-center justify-between p-3.5 rounded-xl glass-panel glass-panel-hover cursor-pointer group/item"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-900 flex items-center justify-center shrink-0">
                      <School size={14} className="text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate group-hover/item:text-emerald-300 transition-colors">
                        {cls.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono tracking-wider">{cls.code}</p>
                    </div>
                  </div>
                  <button
                    onClick={e => removeFromHistory(e, cls.code)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-900 smooth-transition"
                    title="清除记录"
                    aria-label="Remove class from history"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Admin Link */}
        <p className="text-center">
          <a
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 smooth-transition"
          >
            <Settings size={12} />
            <span>管理后台</span>
          </a>
        </p>
      </div>
    </main>
  )
}

