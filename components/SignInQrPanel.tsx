'use client'

import { useEffect, useMemo, useState } from 'react'
import { Menu, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

const GREATPATH_BASE_URL =
  process.env.NEXT_PUBLIC_GREATPATH_URL || 'https://greatpath-greatbusiness.com'

// 'all' = class session (whole class, 全班); '1'..'3' = that group's session.
const SCOPES = ['all', '1', '2', '3'] as const
export type SignInScope = (typeof SCOPES)[number]

export interface SignInQr {
  url: string
  label: string
}

function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// greatpath knows classes by 班级 names like "12班", while show class names
// carry a program prefix ("新大12班") — pull out the trailing N班 so the
// records line up with greatpath rosters. Falls back to the full name when
// there's no N班 pattern; the field stays editable either way.
function extractClassName(displayName: string): string {
  const match = displayName.match(/(\d+\s*班)/)
  return match ? match[1].replace(/\s+/g, '') : displayName
}

function scopeLabel(scope: SignInScope): string {
  return scope === 'all' ? '全班' : `${scope} 组`
}

// Sign-in QR for class/group sessions. The QR points at the greatpath app's
// /class-checkin page; students scan it with their phone (already logged
// into greatpath) and the attendance record lands in greatpath's database.
// The generated QR is mirrored as a small always-visible copy in the sidebar
// (via onQrChange) so latecomers can scan mid-presentation.
export function SignInQrPanel({
  classCode,
  classDisplayName,
  onToggleSidebar,
  onQrChange,
}: {
  classCode: string
  classDisplayName?: string
  onToggleSidebar?: () => void
  onQrChange?: (qr: SignInQr | null) => void
}) {
  const storageKey = `greatpath-show:${classCode}:signin-class-name`
  const [className, setClassName] = useState('')
  const [scope, setScope] = useState<SignInScope>('all')
  const [date, setDate] = useState(today())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    setClassName(saved || (classDisplayName ? extractClassName(classDisplayName) : ''))
    setHydrated(true)
  }, [storageKey, classDisplayName])

  useEffect(() => {
    if (!hydrated) return
    if (className.trim()) window.localStorage.setItem(storageKey, className.trim())
  }, [className, hydrated, storageKey])

  const signInQr = useMemo<SignInQr | null>(() => {
    const name = className.trim()
    if (!name) return null
    const params = new URLSearchParams({ class: name, date })
    if (scope !== 'all') params.set('group', scope)
    return {
      url: `${GREATPATH_BASE_URL}/class-checkin?${params.toString()}`,
      label: `${name} · ${scopeLabel(scope)} · ${date}`,
    }
  }, [className, scope, date])

  useEffect(() => {
    onQrChange?.(signInQr)
  }, [signInQr, onQrChange])

  return (
    <div className="flex-1 min-w-0 h-screen overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 -ml-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-gray-900 md:hidden"
              aria-label="打开侧栏"
            >
              <Menu size={18} />
            </button>
          )}
          <div className="w-8 h-8 rounded-lg border bg-emerald-950/40 border-emerald-900/30 flex items-center justify-center">
            <QrCode size={16} className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">签到二维码</h2>
            <p className="text-xs text-gray-500">学员扫码后在 Greatpath 完成签到（需已登录）</p>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              班级（须与 Greatpath 班级名称一致，如 12班）
            </label>
            <input
              value={className}
              onChange={e => setClassName(e.target.value)}
              placeholder="例如：12班"
              className="w-full px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-700 text-sm"
            />
          </div>

          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                场次类型
              </label>
              <div className="inline-flex rounded-xl border border-gray-800 bg-gray-950 p-1 gap-1">
                {SCOPES.map(s => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      scope === s
                        ? 'bg-emerald-600/20 text-emerald-300'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {scopeLabel(s)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                日期
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-800 text-gray-100 focus:outline-none focus:border-emerald-700 text-sm [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* QR display */}
        {signInQr ? (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-5 rounded-2xl">
              <QRCodeSVG value={signInQr.url} size={280} level="M" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold">{signInQr.label}</p>
              <p className="text-xs text-gray-500 mt-1 break-all max-w-md">{signInQr.url}</p>
              <p className="text-xs text-emerald-500/80 mt-2">
                二维码已同步显示在侧栏，切换到其他功能后迟到的学员仍可扫码
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-gray-600">
            <QrCode size={48} className="opacity-40" />
            <p className="text-sm">填写班级名称后生成二维码</p>
          </div>
        )}
      </div>
    </div>
  )
}
