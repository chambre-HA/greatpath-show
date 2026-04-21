'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronRight, Copy, EllipsisVertical, FileText, Link2, Pencil, Presentation, Plus, Save, Trash2, X, ArrowUp, ArrowDown } from 'lucide-react'
import { cloneLink, makeLink, validateLinkInput } from '@/lib/links-store'
import type { ClassInfo, ShowLink } from '@/types'

// ── API helpers ──────────────────────────────────────────────────────────────

async function adminPost(password: string, body: object) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, ...body }),
  })
  if (res.status === 401) throw new Error('Wrong password')
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Error ${res.status}`)
  }
  return res.json()
}

// ── Sub-components ───────────────────────────────────────────────────────────

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

type ContextMenuState = { id: string; x: number; y: number } | null

function ClassLinks({ password, classCode, classes }: { password: string; classCode: string; classes: ClassInfo[] }) {
  const [links, setLinks] = useState<ShowLink[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [copyingLink, setCopyingLink] = useState<ShowLink | null>(null)
  const [copyTargetCode, setCopyTargetCode] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminPost(password, { action: 'listLinks', code: classCode })
      setLinks(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const check = validateLinkInput(url)
    if (!check.ok) { setError(check.reason); return }
    setBusy(true)
    try {
      await adminPost(password, { action: 'addLink', code: classCode, link: makeLink(title, url, check.kind) })
      setTitle('')
      setUrl('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string) {
    setContextMenu(null)
    try {
      await adminPost(password, { action: 'removeLink', code: classCode, id })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
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
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
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
      setError(e instanceof Error ? e.message : 'Failed')
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
      setCopyingLink(null)
      setCopyTargetCode('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  const menuLink = contextMenu ? links.find(link => link.id === contextMenu.id) ?? null : null
  const copyTargets = classes.filter(cls => cls.code !== classCode)

  if (loading) return <p className="text-xs text-gray-500 py-2">Loading…</p>

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-400">{error}</p>}

      <form onSubmit={handleAdd} className="space-y-2 p-3 rounded-lg bg-gray-900 border border-gray-800">
        <p className="text-xs font-semibold text-gray-400">Add link</p>
        <input
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full px-2 py-1.5 text-sm rounded bg-gray-950 border border-gray-700 text-gray-100 placeholder-gray-600"
        />
        <input
          type="url"
          placeholder="https://…"
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
          className="w-full px-2 py-1.5 text-sm rounded bg-gray-950 border border-gray-700 text-gray-100 placeholder-gray-600"
        />
        <button type="submit" disabled={busy}
          className="w-full py-1.5 text-sm rounded bg-gray-100 text-gray-900 font-medium hover:bg-white disabled:opacity-50">
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>

      {links.length === 0 ? (
        <p className="text-xs text-gray-600 italic">No links yet.</p>
      ) : (
        <div className="relative">
        <ul className="space-y-1">
          {links.map(link => {
            const isExternal = !link.id.startsWith('r2:')
            const sizeMb = link.size ? Math.round(link.size / (1024 * 1024)) : null
            const isEditing = editingId === link.id
            return (
              <li
                key={link.id}
                className="px-2 py-2 rounded bg-gray-900 group space-y-2"
                onContextMenu={e => {
                  e.preventDefault()
                  openContextMenu(link, e.clientX, e.clientY)
                }}
              >
                <div className="flex items-start gap-2">
                  {link.kind === 'pdf'
                    ? <FileText size={13} className="text-red-400 shrink-0" />
                    : <Presentation size={13} className="text-orange-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="w-full px-2 py-1.5 text-sm rounded bg-gray-950 border border-gray-700 text-gray-100"
                        />
                        <input
                          type="url"
                          value={editUrl}
                          onChange={e => setEditUrl(e.target.value)}
                          disabled={!isExternal}
                          className="w-full px-2 py-1.5 text-xs rounded bg-gray-950 border border-gray-700 text-gray-300 disabled:opacity-60"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-200 truncate">{link.title}</p>
                        <p className="text-[10px] text-gray-600 flex items-center gap-1 truncate">
                          {isExternal ? <><Link2 size={10} />{hostOf(link.url)}</> : <>{sizeMb} MB</>}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="shrink-0">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => handleSave(link)}
                        disabled={busy}
                        className="p-1.5 rounded text-gray-500 hover:text-emerald-400 hover:bg-gray-800 disabled:opacity-30"
                        aria-label="Save"
                      >
                        <Save size={12} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          const rect = e.currentTarget.getBoundingClientRect()
                          openContextMenu(link, rect.right + 4, rect.top)
                        }}
                        disabled={busy}
                        className="p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30"
                        aria-label="Actions"
                      >
                        <EllipsisVertical size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <p className="text-[10px] text-gray-700">Right-click for doc actions</p>
                )}
                {isEditing && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null)
                        setEditTitle('')
                        setEditUrl('')
                      }}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {menuLink && contextMenu && (
          <div
            className="fixed z-50 w-44 rounded-lg border border-gray-800 bg-gray-950 shadow-2xl overflow-hidden"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={e => e.stopPropagation()}
          >
            <button type="button" onClick={() => startEdit(menuLink)} className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-900 flex items-center gap-2">
              <Pencil size={12} /> Edit
            </button>
            <button type="button" onClick={() => handleMove(menuLink.id, -1)} disabled={busy || links[0]?.id === menuLink.id} className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-900 disabled:opacity-30 flex items-center gap-2">
              <ArrowUp size={12} /> Move up
            </button>
            <button type="button" onClick={() => handleMove(menuLink.id, 1)} disabled={busy || links[links.length - 1]?.id === menuLink.id} className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-900 disabled:opacity-30 flex items-center gap-2">
              <ArrowDown size={12} /> Move down
            </button>
            <button type="button" onClick={() => openCopyDialog(menuLink)} disabled={copyTargets.length === 0} className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-900 disabled:opacity-30 flex items-center gap-2">
              <Copy size={12} /> Copy to class
            </button>
            <button type="button" onClick={() => handleRemove(menuLink.id)} className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-900 flex items-center gap-2">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
        </div>
      )}

      {copyingLink && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-950 p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Copy doc to another class</h3>
              <p className="text-xs text-gray-500 truncate">{copyingLink.title}</p>
            </div>
            <select
              value={copyTargetCode}
              onChange={e => setCopyTargetCode(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded bg-gray-900 border border-gray-700 text-gray-100"
            >
              <option value="">Select target class</option>
              {copyTargets.map(cls => (
                <option key={cls.code} value={cls.code}>
                  {cls.code} - {cls.name}
                </option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setCopyingLink(null)
                  setCopyTargetCode('')
                }}
                className="text-sm text-gray-500 hover:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCopyToClass}
                disabled={busy || !copyTargetCode}
                className="px-3 py-2 text-sm rounded bg-gray-100 text-gray-900 font-medium hover:bg-white disabled:opacity-40"
              >
                {busy ? 'Copying…' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main admin page ──────────────────────────────────────────────────────────

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
      setAuthError(e instanceof Error ? e.message : 'Failed')
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
      setClassError('Class code must be exactly 8 digits.')
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
      setClassError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setClassBusy(false)
    }
  }

  async function handleDeleteClass(code: string) {
    if (!confirm(`Delete class ${code}? This removes the class entry but not the files in R2.`)) return
    try {
      await adminPost(password, { action: 'deleteClass', code })
      if (selectedCode === code) setSelectedCode(null)
      await loadClasses(password)
    } catch (e) {
      setClassError(e instanceof Error ? e.message : 'Failed')
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
      setClassError('Class name cannot be empty.')
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
      setClassError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setClassBusy(false)
    }
  }

  // ── Login screen ──────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-full max-w-sm space-y-6 px-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-white">Admin</h1>
            <p className="text-sm text-gray-500">共修平台 management</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
            {authError && <p className="text-xs text-red-400 text-center">{authError}</p>}
            <button type="submit" disabled={authBusy || !password}
              className="w-full py-3 rounded-lg bg-gray-100 text-gray-900 font-semibold hover:bg-white disabled:opacity-40 transition">
              {authBusy ? 'Verifying…' : 'Sign in'}
            </button>
          </form>
          <p className="text-center">
            <a href="/" className="text-xs text-gray-700 hover:text-gray-500">← Back</a>
          </p>
        </div>
      </main>
    )
  }

  // ── Admin dashboard ───────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Admin</h1>
          <p className="text-xs text-gray-500">共修平台</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-xs text-gray-500 hover:text-gray-300">← Home</a>
          <button onClick={() => setAuthed(false)} className="text-xs text-gray-600 hover:text-gray-400">Sign out</button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Class list */}
        <aside className="w-72 shrink-0 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Classes</p>
            <form onSubmit={handleAddClass} className="space-y-2">
              <input
                type="text"
                placeholder="Class code (e.g. 42241037)"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                inputMode="numeric"
                maxLength={8}
                className="w-full px-2 py-1.5 text-sm rounded bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-600 font-mono"
              />
              <input
                type="text"
                placeholder="Class name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-2 py-1.5 text-sm rounded bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-600"
              />
              {classError && <p className="text-xs text-red-400">{classError}</p>}
              <button type="submit" disabled={classBusy || !newCode.trim() || !newName.trim()}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-sm rounded bg-gray-800 text-gray-200 hover:bg-gray-700 disabled:opacity-40">
                <Plus size={14} /> Add Class
              </button>
            </form>
          </div>

          <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {classes.length === 0 && (
              <li className="px-2 py-4 text-xs text-gray-600 italic text-center">No classes yet.</li>
            )}
            {classes.map(cls => (
              <li key={cls.code}>
                <div
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded cursor-pointer ${
                    selectedCode === cls.code ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-900'
                  }`}
                  onClick={() => setSelectedCode(cls.code)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">{cls.code}</p>
                    {editingClassCode === cls.code ? (
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={editClassName}
                          onChange={e => setEditClassName(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="w-full px-2 py-1 text-[11px] rounded bg-gray-950 border border-gray-700 text-gray-100"
                        />
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            handleSaveClassName(cls)
                          }}
                          disabled={classBusy}
                          className="p-1 text-gray-400 hover:text-emerald-400 disabled:opacity-30"
                          aria-label="Save class name"
                        >
                          <Save size={12} />
                        </button>
                      </div>
                    ) : (
                      cls.name && <p className="text-[10px] text-gray-500 truncate">{cls.name}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      startEditClass(cls)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-gray-300 shrink-0"
                    aria-label="Edit class name"
                  >
                    <Pencil size={12} />
                  </button>
                  <ChevronRight size={14} className={`shrink-0 transition-opacity ${selectedCode === cls.code ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`} />
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteClass(cls.code) }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 shrink-0"
                    aria-label="Delete class"
                  >
                    <X size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Links panel */}
        <section className="flex-1 overflow-y-auto p-6">
          {!selectedCode ? (
            <div className="h-full flex items-center justify-center text-gray-600 text-sm">
              Select a class to manage its links
            </div>
          ) : (
            <div className="max-w-lg space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white font-mono">{selectedCode}</h2>
                <p className="text-xs text-gray-500">
                  {selectedClass?.name ?? selectedCode}
                </p>
              </div>
              <ClassLinks password={password} classCode={selectedCode} classes={classes} />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
