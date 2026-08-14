'use client'

import { useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { blocksToBody } from '@/lib/dingke-resolve'
import type { DingkeSectionEdit } from '@/lib/dingke-store'
import type { DingkeSection } from '@/types'

/**
 * Per-class wording edits for one section. Fields are prefilled with the
 * resolved text; the server drops anything still equal to the default, so
 * saving an untouched field doesn't pin it against future script updates.
 */
export function DingkeEditor({
  section, overridden, onSave, onReset, onClose,
}: {
  section: DingkeSection
  overridden: boolean
  onSave: (edit: DingkeSectionEdit) => Promise<void>
  onReset: () => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState(section.title)
  const [subtitle, setSubtitle] = useState(section.subtitle ?? '')
  const [slideLines, setSlideLines] = useState(section.slide.lines.join('\n'))
  const [body, setBody] = useState(blocksToBody(section.blocks))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/80 smooth-transition'
  const label = 'block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5'

  return (
    <div className="absolute inset-0 z-50 bg-gray-950/80 backdrop-blur-sm flex items-stretch justify-end">
      <div className="w-full max-w-xl h-full bg-gray-950 border-l border-gray-800 flex flex-col">
        <header className="shrink-0 px-5 py-4 border-b border-gray-800/80 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white">编辑「{section.title}」</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">仅本班可见，其他班级仍使用标准模板</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white smooth-transition" aria-label="关闭">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-4">
          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/20 py-2 px-4 rounded-xl border border-rose-900/30">{error}</p>
          )}

          <div>
            <label className={label}>环节名称</label>
            <input className={field} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={label}>副标题</label>
            <input className={field} value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="可留空" />
          </div>
          <div>
            <label className={label}>大字内容（每行一句）</label>
            <textarea
              className={`${field} font-mono text-xs leading-relaxed`}
              rows={5}
              value={slideLines}
              onChange={e => setSlideLines(e.target.value)}
            />
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              以 <code className="text-slate-400">#</code> 开头的行显示为橙色小标题，可把一页分成几组
              （如 <code className="text-slate-400"># 十八字方针</code>）；以 <code className="text-slate-400">-</code> 开头的行
              显示为较小的说明文字（如 <code className="text-slate-400">- 五处用心 —— 定课 —— 打卡</code>）。
            </p>
          </div>
          <div>
            <label className={label}>主持人念诵稿</label>
            <textarea
              className={`${field} font-mono text-xs leading-relaxed`}
              rows={14}
              value={body}
              onChange={e => setBody(e.target.value)}
            />
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              空行分段。以「主持人白」开头的段落显示为绿色提示；以「※」开头显示为备注；
              <code className="text-slate-400">{'{{回向名单}}'}</code> 会替换成本班当周的回向名单。
            </p>
          </div>
        </div>

        <footer className="shrink-0 px-5 py-4 border-t border-gray-800/80 flex items-center gap-2">
          {overridden && (
            <button
              onClick={() => run(onReset)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 smooth-transition disabled:opacity-40"
            >
              <RotateCcw size={13} />
              <span>恢复默认</span>
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 smooth-transition"
          >
            取消
          </button>
          <button
            onClick={() => run(() => onSave({
              title,
              subtitle,
              slideLines: slideLines.split('\n'),
              body,
            }))}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold active:scale-[0.98] smooth-transition disabled:opacity-40 disabled:pointer-events-none"
          >
            {busy ? '保存中…' : '保存'}
          </button>
        </footer>
      </div>
    </div>
  )
}
