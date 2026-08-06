'use client'

import { useEffect, useState } from 'react'
import { Menu, Pencil, QrCode, RefreshCw, School, Trash2, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { ClassSignin } from '@/types'

// Sign-in QR for class/group sessions. greatpath issues check-in links with a
// passcode staff can rotate there; students scan, enter the passcode, and the
// attendance record lands in greatpath's database (no greatpath login needed).
//
// Two links can apply, mirroring greatpath: the class's own link (managed on
// the class card in 班级管理) wins, and the 学堂-wide link an admin assigned is
// the fallback. The class's own link is entered right here — anyone on the
// class page can paste it, and it stays until someone replaces or clears it.
//
// The class page keeps a small copy pinned in the sidebar so latecomers can
// scan mid-presentation; this is the enlarged view of the same thing.
// There is deliberately no live check-in list here: greatpath's link check-in
// records students by class_students.id with user_id NULL, and the only public
// read (get-class-session-checkins) resolves names from user_id, so it can
// never see them.
export function SignInQrPanel({
  classCode,
  signin,
  onRefresh,
  onToggleSidebar,
}: {
  classCode: string
  signin: ClassSignin | null
  onRefresh: () => void | Promise<void>
  onToggleSidebar?: () => void
}) {
  const [refreshing, setRefreshing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [passcode, setPasscode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const own = signin?.source === 'class' ? signin : null

  useEffect(() => {
    if (!editing) {
      setUrl(own?.url ?? '')
      setPasscode(own?.passcode ?? '')
      setError(null)
    }
  }, [editing, own?.url, own?.passcode])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  async function post(body: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/class-signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class: classCode, ...body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `保存失败（${res.status}）`)
      setEditing(false)
      await onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!confirm('确定清除本班签到链接？之后将改用学堂的备用链接。')) return
    await post({ action: 'clear' })
  }

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
            <p className="text-xs text-gray-500">扫码后凭口令签到，无需登录 Greatpath</p>
          </div>
        </div>

        {/* QR + passcode: the class's own link, else the 学堂 fallback */}
        {signin ? (
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="bg-white p-5 rounded-2xl">
              <QRCodeSVG value={signin.url} size={280} level="M" />
            </div>
            <div className="text-center">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
                  signin.source === 'class'
                    ? 'border-emerald-900/50 bg-emerald-950/40 text-emerald-300'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400'
                }`}
              >
                {signin.source === 'class' ? <Users size={12} /> : <School size={12} />}
                {signin.source === 'class' ? '本班专属链接' : '学堂备用链接'}
              </span>
              <p className="text-sm font-semibold text-white mt-2">{signin.label}</p>
              {signin.passcode ? (
                <>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-3">口令</p>
                  <p className="text-4xl font-bold text-emerald-300 tracking-[0.2em] mt-1">
                    {signin.passcode}
                  </p>
                </>
              ) : (
                <p className="text-sm text-amber-400/90 mt-3">该链接尚未设置口令</p>
              )}
              <p className="text-xs text-gray-500 mt-3 break-all max-w-md mx-auto">{signin.url}</p>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-xl border border-gray-800 text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-900 disabled:opacity-40 smooth-transition"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : undefined} />
                <span>刷新口令</span>
              </button>
              <p className="text-xs text-emerald-500/80 mt-3">
                二维码已同步显示在侧栏，切换到其他功能后迟到的学员仍可扫码
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 mb-8 text-gray-600">
            <QrCode size={48} className="opacity-40" />
            <p className="text-sm text-center max-w-sm">
              本班尚未设置签到链接。可在下方填入本班在 Greatpath「班级管理」中的专属链接与口令，
              或请管理员在后台为本班关联学堂。
            </p>
          </div>
        )}

        {/* The class's own link — maintained by the class itself */}
        <div className="rounded-2xl border border-gray-800 bg-gray-950/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white">本班签到链接</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                来自 Greatpath「班级管理」班级卡片上的专属链接，保存后本班一直使用，直到有人修改。
              </p>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-800 text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-900 smooth-transition"
              >
                <Pencil size={12} />
                <span>{own ? '修改' : '添加'}</span>
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-4 space-y-2">
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="签到链接（https://…/checkin/…）"
                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white placeholder:text-gray-600 outline-none focus:border-gray-600"
              />
              <input
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                placeholder="口令（如：012459）"
                className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-sm text-white placeholder:text-gray-600 outline-none focus:border-gray-600 tracking-[0.15em]"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => post({ action: 'save', url, passcode })}
                  disabled={saving || !url.trim()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 smooth-transition"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-xl border border-gray-800 text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-900 disabled:opacity-40 smooth-transition"
                >
                  取消
                </button>
              </div>
            </div>
          ) : own ? (
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 break-all">{own.url}</p>
                <p className="text-xs text-gray-500 mt-1">
                  口令 <span className="text-emerald-300 font-semibold tracking-[0.15em]">{own.passcode || '未设置'}</span>
                  {own.updatedAt && (
                    <span className="text-gray-600">
                      {' '}· 更新于 {new Date(own.updatedAt).toLocaleString('zh-CN', { hour12: false })}
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleClear}
                disabled={saving}
                className="shrink-0 p-2 rounded-xl border border-gray-800 text-gray-500 hover:text-red-400 hover:bg-gray-900 disabled:opacity-40 smooth-transition"
                aria-label="清除本班签到链接"
                title="清除，改用学堂备用链接"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs text-gray-600">尚未设置，当前使用学堂的备用链接。</p>
          )}
          {!editing && error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}
