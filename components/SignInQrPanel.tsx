'use client'

import { useState } from 'react'
import { Menu, QrCode, RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { ClassSignin } from '@/types'

// Sign-in QR for class/group sessions. greatpath issues one fixed check-in URL
// per 学堂 plus a passcode staff can rotate there; an admin assigns the 学堂 to
// each class, so this panel only renders what the class resolves to — students
// scan, enter the passcode, and the attendance record lands in greatpath's
// database (no greatpath login needed).
// The class page keeps a small copy pinned in the sidebar so latecomers can
// scan mid-presentation; this is the enlarged view of the same thing.
// There is deliberately no live check-in list here: greatpath's link check-in
// records students by class_students.id with user_id NULL, and the only public
// read (get-class-session-checkins) resolves names from user_id, so it can
// never see them.
export function SignInQrPanel({
  signin,
  onRefresh,
  onToggleSidebar,
}: {
  signin: ClassSignin | null
  onRefresh: () => void | Promise<void>
  onToggleSidebar?: () => void
}) {
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
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

        {/* QR + passcode, resolved from the 学堂 an admin assigned this class */}
        {signin ? (
          <div className="flex flex-col items-center gap-4 mb-10">
            <div className="bg-white p-5 rounded-2xl">
              <QRCodeSVG value={signin.url} size={280} level="M" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">{signin.schoolName}</p>
              {signin.passcode ? (
                <>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-3">口令</p>
                  <p className="text-4xl font-bold text-emerald-300 tracking-[0.2em] mt-1">
                    {signin.passcode}
                  </p>
                </>
              ) : (
                <p className="text-sm text-amber-400/90 mt-3">该学堂尚未设置口令</p>
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
          <div className="flex flex-col items-center gap-3 py-16 mb-10 text-gray-600">
            <QrCode size={48} className="opacity-40" />
            <p className="text-sm text-center max-w-sm">
              本班级尚未关联学堂。请在管理后台的「学堂签到链接」中为本班级指定学堂。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
