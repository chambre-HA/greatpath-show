'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ChevronRight, Copy, EllipsisVertical, FileText, Link2, Pencil, Presentation, Plus, RotateCcw, Save, ShieldAlert, Trash2, X, ArrowUp, ArrowDown, Shield, LogOut, Check, School } from 'lucide-react'
import { cloneLink, validateLinkInput } from '@/lib/links-store'
import { AddDocPanel } from '@/components/AddDocPanel'
import type { ClassInfo, ShowLink } from '@/types'

// ── API helpers ──────────────────────────────────────────────────────────────

async function adminPost(password: string, body: object) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, ...body }),
  })
  if (res.status === 401) throw new Error('密码错误')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `错误代码 ${res.status}`)
  }
  return res.json()
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

type ContextMenuState = { id: string; x: number; y: number } | null

// ── ClassLinks Component ──────────────────────────────────────────────────────

function ClassLinks({ password, classCode, classes }: { password: string; classCode: string; classes: ClassInfo[] }) {
  const [links, setLinks] = useState<ShowLink[]>([])
  const [hiddenLinks, setHiddenLinks] = useState<ShowLink[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [copyingLink, setCopyingLink] = useState<ShowLink | null>(null)
  const [copyTargetCode, setCopyTargetCode] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [active, hidden] = await Promise.all([
        adminPost(password, { action: 'listLinks', code: classCode }),
        adminPost(password, { action: 'listHiddenLinks', code: classCode }),
      ])
      setLinks(Array.isArray(active) ? active : [])
      setHiddenLinks(Array.isArray(hidden) ? hidden : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载文件失败')
    } finally {
      setLoading(false)
    }
  }, [password, classCode])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!contextMenu) return
    function closeMenu() {
      setContextMenu(null)
    }
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [contextMenu])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2000)
  }

  async function handleAdd(link: ShowLink) {
    await adminPost(password, { action: 'addLink', code: classCode, link })
    showToast('文件添加成功')
    await load()
  }

  async function handleRemove(id: string) {
    setContextMenu(null)
    try {
      await adminPost(password, { action: 'removeLink', code: classCode, id })
      showToast('文件已隐藏/移除')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  async function handleRestore(id: string) {
    try {
      await adminPost(password, { action: 'restoreLink', code: classCode, id })
      showToast('文件已成功恢复')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '恢复失败')
    }
  }

  async function handlePurge(id: string) {
    if (!confirm('确定彻底从云存储中删除此文件？此操作不可撤销！')) return
    try {
      await adminPost(password, { action: 'purgeLink', code: classCode, id })
      showToast('文件已永久删除')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '彻底删除失败')
    }
  }

  function startEdit(link: ShowLink) {
    setContextMenu(null)
    setEditingId(link.id)
    setEditTitle(link.title)
    setEditUrl(link.url)
    setError(null)
  }

  async function handleSave(link: ShowLink) {
    const title = editTitle.trim() || link.title
    const nextUrl = link.id.startsWith('r2:') ? link.url : editUrl.trim()
    let nextKind = link.kind

    if (!link.id.startsWith('r2:')) {
      const check = validateLinkInput(nextUrl)
      if (!check.ok) {
        setError(check.reason)
        return
      }
      nextKind = check.kind
    }

    setBusy(true)
    setError(null)
    try {
      await adminPost(password, {
        action: 'updateLink',
        code: classCode,
        link: { ...link, title, url: nextUrl, kind: nextKind, order: link.order },
      })
      setEditingId(null)
      setEditTitle('')
      setEditUrl('')
      showToast('更新成功')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleMove(id: string, direction: -1 | 1) {
    setContextMenu(null)
    const index = links.findIndex(link => link.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= links.length) return

    const reordered = [...links]
    const [item] = reordered.splice(index, 1)
    reordered.splice(target, 0, item)

    setBusy(true)
    setError(null)
    try {
      await adminPost(password, {
        action: 'reorderLinks',
        code: classCode,
        ids: reordered.map(link => link.id),
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '排序失败')
    } finally {
      setBusy(false)
    }
  }

  function openContextMenu(link: ShowLink, x: number, y: number) {
    setContextMenu({ id: link.id, x, y })
  }

  function openCopyDialog(link: ShowLink) {
    setContextMenu(null)
    setCopyingLink(link)
    const firstTarget = classes.find(cls => cls.code !== classCode)?.code ?? ''
    setCopyTargetCode(firstTarget)
  }

  async function handleCopyToClass() {
    if (!copyingLink || !copyTargetCode) return
    setBusy(true)
    setError(null)
    try {
      await adminPost(password, {
        action: 'addLink',
        code: copyTargetCode,
        link: cloneLink(copyingLink),
      })
      showToast(`复制到目标班级成功`)
      setCopyingLink(null)
      setCopyTargetCode('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '复制失败')
    } finally {
      setBusy(false)
    }
  }

  const menuLink = contextMenu ? links.find(link => link.id === contextMenu.id) ?? null : null
  const copyTargets = classes.filter(cls => cls.code !== classCode)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-500 text-xs gap-2">
        <svg className="animate-spin h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>正在载入文件管理...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs text-rose-400 bg-rose-950/20 py-2 px-3 rounded-xl border border-rose-900/30">
          {error}
        </p>
      )}

      {/* Add Document Box */}
      <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-450 uppercase tracking-wider">上传或关联新文件</p>
          <button
            type="button"
            onClick={() => setAdding(v => !v)}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white border smooth-transition ${
              adding ? 'bg-slate-800 border-slate-700' : 'bg-slate-950 border-slate-850 hover:bg-slate-900'
            }`}
          >
            {adding ? <X size={13} /> : <Plus size={13} />}
          </button>
        </div>
        {adding && (
          <div className="pt-2 border-t border-slate-800/40">
            <AddDocPanel classCode={classCode} onAdd={handleAdd} onClose={() => setAdding(false)} />
          </div>
        )}
      </div>

      {/* Active Links List */}
      {links.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-6 glass-panel rounded-2xl border border-slate-800/80">
          暂无已关联文件。
        </p>
      ) : (
        <div className="relative">
          <ul className="space-y-2">
            {links.map(link => {
              const isExternal = !link.id.startsWith('r2:')
              const sizeMb = link.size ? Math.round(link.size / (1024 * 1024)) : null
              const isEditing = editingId === link.id
              return (
                <li
                  key={link.id}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 bg-slate-900/30 hover:bg-slate-900/50 ${
                    isEditing ? 'border-emerald-500/40' : 'border-slate-850/80'
                  } space-y-3 group`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-center shrink-0">
                      {link.kind === 'pdf'
                        ? <FileText size={15} className="text-rose-400" />
                        : <Presentation size={15} className="text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2 pt-0.5">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-emerald-500 transition-all"
                            placeholder="文件标题"
                          />
                          <input
                            type="url"
                            value={editUrl}
                            onChange={e => setEditUrl(e.target.value)}
                            disabled={!isExternal}
                            className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-350 disabled:opacity-50 focus:outline-none focus:border-emerald-500 transition-all"
                            placeholder="链接地址"
                          />
                        </div>
                      ) : (
                        <div className="pt-0.5">
                          <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">{link.title}</p>
                          <p className="text-[10px] text-slate-500 font-mono tracking-wider mt-1 flex items-center gap-1">
                            {isExternal ? <><Link2 size={10} className="opacity-60" />{hostOf(link.url)}</> : <>{sizeMb} MB</>}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => handleSave(link)}
                          disabled={busy}
                          className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white smooth-transition"
                          aria-label="Save"
                        >
                          <Save size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            const rect = e.currentTarget.getBoundingClientRect()
                            openContextMenu(link, rect.left - 130, rect.bottom + 8)
                          }}
                          disabled={busy}
                          className="p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800 smooth-transition border border-transparent hover:border-slate-700/50"
                          aria-label="Actions"
                        >
                          <EllipsisVertical size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex justify-end gap-3 border-t border-slate-800/40 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setEditTitle('')
                          setEditUrl('')
                        }}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-300"
                      >
                        取消
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {/* Floating actions dropdown menu (mobile accessible) */}
          {menuLink && contextMenu && (
            <div
              className="fixed z-[100] w-40 rounded-xl border border-slate-800/80 bg-slate-950 shadow-2xl overflow-hidden p-1 animate-scale-up"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={e => e.stopPropagation()}
            >
              <button type="button" onClick={() => startEdit(menuLink)} className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 rounded-lg flex items-center gap-2 smooth-transition">
                <Pencil size={13} className="text-emerald-400" />
                <span>编辑文件</span>
              </button>
              <button type="button" onClick={() => handleMove(menuLink.id, -1)} disabled={busy || links[0]?.id === menuLink.id} className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 disabled:opacity-30 rounded-lg flex items-center gap-2 smooth-transition">
                <ArrowUp size={13} className="text-slate-500" />
                <span>上移一行</span>
              </button>
              <button type="button" onClick={() => handleMove(menuLink.id, 1)} disabled={busy || links[links.length - 1]?.id === menuLink.id} className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 disabled:opacity-30 rounded-lg flex items-center gap-2 smooth-transition">
                <ArrowDown size={13} className="text-slate-500" />
                <span>下移一行</span>
              </button>
              <button type="button" onClick={() => openCopyDialog(menuLink)} disabled={copyTargets.length === 0} className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-900 disabled:opacity-30 rounded-lg flex items-center gap-2 smooth-transition">
                <Copy size={13} className="text-blue-400" />
                <span>复制到其他班</span>
              </button>
              <button type="button" onClick={() => handleRemove(menuLink.id)} className="w-full px-3 py-2 text-left text-xs font-bold text-rose-400 hover:bg-rose-950/20 rounded-lg flex items-center gap-2 smooth-transition border-t border-slate-900/50 mt-1">
                <Trash2 size={13} />
                <span>隐藏文件</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hidden Files View */}
      {hiddenLinks.length > 0 && (
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => setShowHidden(v => !v)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-300 smooth-transition"
          >
            <ShieldAlert size={13} />
            <span>{showHidden ? '收起' : '展开'}已隐藏文件 ({hiddenLinks.length})</span>
          </button>
          
          {showHidden && (
            <ul className="space-y-1.5">
              {hiddenLinks.map(link => (
                <li key={link.id} className="flex items-center justify-between px-3 py-3 rounded-2xl bg-slate-950/60 border border-slate-850 p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 text-slate-600">
                      {link.kind === 'pdf' ? <FileText size={14} /> : <Presentation size={14} />}
                    </div>
                    <span className="text-xs text-slate-500 truncate max-w-[200px]">{link.title}</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestore(link.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-900 smooth-transition"
                      title="恢复此文件"
                    >
                      <RotateCcw size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurge(link.id)}
                      className="p-1.5 rounded-lg text-slate-550 hover:text-rose-500 hover:bg-slate-900 smooth-transition"
                      title="彻底删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Copy dialog modal overlay */}
      {copyingLink && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4 shadow-2xl animate-scale-up">
            <div>
              <h3 className="text-sm font-bold text-white">复制此文件到其他班级</h3>
              <p className="text-xs text-slate-550 truncate mt-1">{copyingLink.title}</p>
            </div>
            <select
              value={copyTargetCode}
              onChange={e => setCopyTargetCode(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none focus:border-emerald-500 transition-all"
            >
              <option value="">-- 选择目标班级 --</option>
              {copyTargets.map(cls => (
                <option key={cls.code} value={cls.code}>
                  {cls.name} ({cls.code})
                </option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-3 border-t border-slate-900 pt-3">
              <button
                type="button"
                onClick={() => {
                  setCopyingLink(null)
                  setCopyTargetCode('')
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCopyToClass}
                disabled={busy || !copyTargetCode}
                className="px-4 py-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all duration-200"
              >
                {busy ? '复制中...' : '确认复制'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] px-4 py-3 rounded-xl glass-panel border border-emerald-500/30 text-white text-xs font-semibold shadow-2xl flex items-center gap-2">
          <Check size={14} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}

// ── AdminPage Dashboard Component ─────────────────────────────────────────────

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)

  const [classes, setClasses] = useState<ClassInfo[]>([])
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [classError, setClassError] = useState<string | null>(null)
  const [classBusy, setClassBusy] = useState(false)
  const [editingClassCode, setEditingClassCode] = useState<string | null>(null)
  const [editClassName, setEditClassName] = useState('')

  const selectedClass = classes.find(c => c.code === selectedCode) ?? null

  const loadClasses = useCallback(async (pw: string) => {
    const data = await adminPost(pw, { action: 'listClasses' })
    setClasses(Array.isArray(data) ? data : [])
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthBusy(true)
    setAuthError(null)
    try {
      await loadClasses(password)
      setAuthed(true)
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : '密码验证失败')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault()
    const code = newCode.trim()
    const name = newName.trim()
    if (!code || !name) return
    if (!/^\d{8}$/.test(code)) {
      setClassError('班级码必须是 8 位数字邀请码。')
      return
    }
    setClassBusy(true)
    setClassError(null)
    try {
      await adminPost(password, { action: 'addClass', code, name })
      setNewCode('')
      setNewName('')
      await loadClasses(password)
    } catch (e) {
      setClassError(e instanceof Error ? e.message : '添加班级失败')
    } finally {
      setClassBusy(false)
    }
  }

  async function handleDeleteClass(code: string) {
    if (!confirm(`确定删除班级 ${code}？这仅移除班级关联，不会清理云存储。`)) return
    try {
      await adminPost(password, { action: 'deleteClass', code })
      if (selectedCode === code) setSelectedCode(null)
      await loadClasses(password)
    } catch (e) {
      setClassError(e instanceof Error ? e.message : '删除班级失败')
    }
  }

  function startEditClass(cls: ClassInfo) {
    setEditingClassCode(cls.code)
    setEditClassName(cls.name)
    setClassError(null)
  }

  async function handleSaveClassName(cls: ClassInfo) {
    const name = editClassName.trim()
    if (!name) {
      setClassError('班级名称不能为空。')
      return
    }
    setClassBusy(true)
    setClassError(null)
    try {
      await adminPost(password, {
        action: 'updateClass',
        code: cls.code,
        name,
        createdAt: cls.createdAt,
      })
      setEditingClassCode(null)
      setEditClassName('')
      await loadClasses(password)
    } catch (e) {
      setClassError(e instanceof Error ? e.message : '更改名称失败')
    } finally {
      setClassBusy(false)
    }
  }

  // ── Login screen ──────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <main className="min-h-screen premium-glow-bg flex items-center justify-center p-4">
        {/* Decorative blurred blob */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-sm space-y-8 z-10">
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-center text-emerald-400 shadow-md">
              <Shield size={24} />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-white">管理后台</h1>
              <p className="text-xs text-slate-400">请输入管理员密码进行登录</p>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="管理员密码"
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500 transition-all"
              />
              {authError && (
                <p className="text-xs text-rose-450 bg-rose-950/20 py-1.5 px-3 rounded-lg border border-rose-900/30 text-center">
                  {authError}
                </p>
              )}
              <button 
                type="submit" 
                disabled={authBusy || !password}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200"
              >
                {authBusy ? '登录验证中...' : '登录后台'}
              </button>
            </form>
          </div>
          
          <p className="text-center">
            <a href="/" className="text-xs text-slate-500 hover:text-slate-300 smooth-transition">← 返回首页</a>
          </p>
        </div>
      </main>
    )
  }

  // ── Admin dashboard ───────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-955 text-slate-100 premium-glow-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
            <Shield size={16} className="text-emerald-400" />
            <span>管理中心</span>
          </h1>
          <p className="text-[10px] text-slate-550 font-medium tracking-wide">大道大商 . 共修平台班级与文件管理后台</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-xs font-semibold text-slate-400 hover:text-white smooth-transition">首页</a>
          <button 
            onClick={() => setAuthed(false)} 
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rose-400 smooth-transition"
          >
            <LogOut size={12} />
            <span>注销</span>
          </button>
        </div>
      </header>

      {/* Main columns */}
      <div className="flex flex-1 min-h-0">
        {/* Class list sidebar */}
        <aside className="w-80 shrink-0 border-r border-slate-800/80 flex flex-col bg-slate-950/40">
          <div className="p-4 border-b border-slate-800/60 space-y-3 bg-slate-950/20">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">创建新班级</p>
            <form onSubmit={handleAddClass} className="space-y-2">
              <input
                type="text"
                placeholder="邀请码 (8位数字)"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                inputMode="numeric"
                maxLength={8}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-650 font-mono tracking-wider focus:outline-none focus:border-emerald-500 transition-all"
              />
              <input
                type="text"
                placeholder="班级名称 (例如: 新大12班)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-650 focus:outline-none focus:border-emerald-500 transition-all"
              />
              {classError && (
                <p className="text-[10px] text-rose-400 bg-rose-950/20 py-1.5 px-3 rounded-lg border border-rose-900/30">
                  {classError}
                </p>
              )}
              <button 
                type="submit" 
                disabled={classBusy || !newCode.trim() || !newName.trim()}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                <Plus size={14} /> 
                <span>添加班级</span>
              </button>
            </form>
          </div>

          {/* Classes navigation list */}
          <div className="flex-1 overflow-y-auto p-2.5">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-3 mb-2">已有班级列表 ({classes.length})</p>
            <ul className="space-y-1">
              {classes.length === 0 && (
                <li className="px-3 py-6 text-xs text-slate-500 italic text-center">暂无班级。</li>
              )}
              {classes.map(cls => (
                <li key={cls.code}>
                  <div
                    className={`group/class flex items-center gap-2.5 px-3 py-3 rounded-xl cursor-pointer border smooth-transition ${
                      selectedCode === cls.code 
                        ? 'bg-emerald-600/15 border-emerald-500/30 text-white' 
                        : 'border-transparent text-slate-350 hover:bg-slate-900/50 hover:text-white'
                    }`}
                    onClick={() => setSelectedCode(cls.code)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold font-mono tracking-wider">{cls.code}</p>
                      {editingClassCode === cls.code ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editClassName}
                            onChange={e => setEditClassName(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-full px-2 py-1 text-[11px] rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              handleSaveClassName(cls)
                            }}
                            disabled={classBusy}
                            className="p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-950 disabled:opacity-30"
                            aria-label="Save class name"
                          >
                            <Save size={12} />
                          </button>
                        </div>
                      ) : (
                        cls.name && <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{cls.name}</p>
                      )}
                    </div>
                    
                    {/* Hover actions */}
                    {editingClassCode !== cls.code && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          startEditClass(cls)
                        }}
                        className="opacity-100 md:opacity-0 md:group-hover/class:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-900 smooth-transition shrink-0"
                        aria-label="Edit name"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    <ChevronRight size={14} className={`shrink-0 transition-all ${selectedCode === cls.code ? 'opacity-100 text-emerald-400' : 'opacity-0 group-hover/class:opacity-40'}`} />
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteClass(cls.code) }}
                      className="opacity-100 md:opacity-0 md:group-hover/class:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-950/20 smooth-transition shrink-0"
                      aria-label="Delete class"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Links management panel */}
        <section className="flex-1 overflow-y-auto p-6 md:p-8">
          {!selectedCode ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
              <School size={36} className="opacity-20" />
              <span>请从左侧列表选择一个班级来管理其关联的学习文档</span>
            </div>
          ) : (
            <div className="max-w-xl space-y-6">
              <div className="flex justify-between items-start border-b border-slate-800/60 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-white font-mono tracking-wider">{selectedCode}</h2>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    当前班级：{selectedClass?.name ?? selectedCode}
                  </p>
                </div>
                <a
                  href={`/class/${selectedCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 smooth-transition"
                >
                  预览班级前台
                </a>
              </div>
              
              <ClassLinks password={password} classCode={selectedCode} classes={classes} />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
