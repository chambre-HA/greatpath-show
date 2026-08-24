'use client'

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { ChevronRight, Copy, EllipsisVertical, Eye, FileText, GripVertical, Library, Link2, Pencil, Presentation, Plus, RotateCcw, Save, ShieldAlert, Trash2, X, Shield, LogOut, Check, School, Sparkles, Tag } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cloneLink, validateLinkInput } from '@/lib/links-store'
import { AddDocPanel } from '@/components/AddDocPanel'
import { DEFAULT_DINGKE_SECTIONS, DINGKE_AUDIO } from '@/lib/dingke-content'
import { blocksToBody, parseBody } from '@/lib/dingke-resolve'
import { SlidePane } from '@/components/DingkeParts'
import type { ClassInfo, ClassSignin, DingkeSection, DingkeVariant, ShowLink } from '@/types'

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

// ── Tags (document categories) ─────────────────────────────────────────────
// Free-form per-document tags, not a separately managed taxonomy like School
// or DingkeVariant — a document just carries whatever labels its own admin
// typed, and every place that lists documents groups/filters by them.

const UNTAGGED = '未分类'

function allTagsOf(links: ShowLink[]): string[] {
  const set = new Set<string>()
  for (const link of links) for (const t of link.tags ?? []) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b, 'zh'))
}

function TagBadges({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map(t => (
        <span key={t} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-300 whitespace-nowrap">
          {t}
        </span>
      ))}
    </span>
  )
}

/** Chip bar for narrowing a document list down to one category at a time. */
function TagFilterBar({
  tags, active, onSelect,
}: { tags: string[]; active: string | null; onSelect: (tag: string | null) => void }) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-[11px] font-bold border smooth-transition ${
          active === null ? 'bg-orange-500/12 text-orange-300 border-orange-500/40' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
        }`}
      >
        全部
      </button>
      {tags.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onSelect(t)}
          className={`px-2.5 py-1 rounded-[var(--radius-sm)] text-[11px] font-bold border smooth-transition ${
            active === t ? 'bg-orange-500/12 text-orange-300 border-orange-500/40' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

/**
 * Multi-select tag combobox: selected tags render as removable chips inside
 * the field itself; typing filters a dropdown of existing tags to pick from,
 * with a "新建标签" option offered whenever the typed text isn't an exact
 * match — so labels don't fork (「课程」vs「课程资料」) while still allowing
 * a genuinely new one.
 */
function TagPicker({
  value, onChange, suggestions,
}: { value: string[]; onChange: (next: string[]) => void; suggestions: string[] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function addTag(raw: string) {
    const tag = raw.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setQuery('')
  }

  function removeTag(tag: string) {
    onChange(value.filter(t => t !== tag))
  }

  const q = query.trim().toLowerCase()
  const filtered = suggestions.filter(s => !value.includes(s) && s.toLowerCase().includes(q))
  const exactExists = q.length > 0 && (
    suggestions.some(s => s.toLowerCase() === q) || value.some(v => v.toLowerCase() === q)
  )

  return (
    <div ref={rootRef} className="relative">
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
        className="w-full min-h-[2.5rem] px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 focus-within:border-orange-500 flex flex-wrap gap-1.5 items-center cursor-text transition-all"
      >
        {value.map(tag => (
          <span key={tag} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-bold bg-zinc-800 text-zinc-200 shrink-0">
            {tag}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); removeTag(tag) }}
              className="p-0.5 rounded-[var(--radius-sm)] hover:bg-zinc-700 text-zinc-400 hover:text-white smooth-transition"
              aria-label={`移除标签 ${tag}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(query) }
            else if (e.key === 'Backspace' && !query && value.length) removeTag(value[value.length - 1])
            else if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={value.length ? '' : '选择或新建标签…'}
          className="flex-1 min-w-[6rem] bg-transparent text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
        />
      </div>
      {open && (filtered.length > 0 || (q.length > 0 && !exactExists)) && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-[var(--radius-sm)] border border-zinc-800 bg-zinc-950 shadow-2xl z-50 max-h-48 overflow-y-auto py-1">
          {q.length > 0 && !exactExists && (
            <button
              type="button"
              onClick={() => addTag(query)}
              className="w-full px-3 py-2 text-left text-xs font-bold text-orange-400 hover:bg-zinc-900 smooth-transition flex items-center gap-1.5"
            >
              <Plus size={12} /> <span>新建标签「{query.trim()}」</span>
            </button>
          )}
          {filtered.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white smooth-transition"
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Wraps one `<li>` with dnd-kit's sortable behavior. The drag handle is a
 * render-prop rather than a fixed child so the caller can place it inside
 * its own flex layout — everything else about the row (edit state, actions
 * menu) is untouched by dragging.
 */
function SortableLinkItem({
  id, disabled, className, children,
}: {
  id: string
  disabled: boolean
  className: string
  children: (drag: { attributes: ReturnType<typeof useSortable>['attributes']; listeners: ReturnType<typeof useSortable>['listeners'] }) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <li ref={setNodeRef} style={style} className={className}>
      {children({ attributes, listeners })}
    </li>
  )
}

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
  const [editTags, setEditTags] = useState<string[]>([])
  const [activeTag, setActiveTag] = useState<string | null>(null)
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
    setEditTags(link.tags ?? [])
    setError(null)
  }

  async function handleSave(link: ShowLink) {
    const title = editTitle.trim() || link.title
    const nextUrl = link.id.startsWith('r2:') ? link.url : editUrl.trim()
    const tags = editTags
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
        link: { ...link, title, url: nextUrl, kind: nextKind, order: link.order, tags: tags.length ? tags : undefined },
      })
      setEditingId(null)
      setEditTitle('')
      setEditUrl('')
      setEditTags([])
      showToast('更新成功')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败')
    } finally {
      setBusy(false)
    }
  }

  // Drag reordering only makes sense against the class's real, unfiltered
  // order — with a tag filter active the visible rows are a subset, so
  // "drop above/below" has no well-defined meaning against the hidden rest.
  // The drag handle is disabled in that case (see visibleLinks below).
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = links.findIndex(l => l.id === active.id)
    const newIndex = links.findIndex(l => l.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(links, oldIndex, newIndex)
    setLinks(reordered) // optimistic — the drag itself already showed this order
    setBusy(true)
    setError(null)
    try {
      await adminPost(password, {
        action: 'reorderLinks',
        code: classCode,
        ids: reordered.map(link => link.id),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '排序失败')
      await load() // revert to the server's actual order
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
  const classTags = allTagsOf(links)
  const visibleLinks = activeTag ? links.filter(l => (l.tags ?? []).includes(activeTag)) : links

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-zinc-500 text-xs gap-2">
        <svg className="animate-spin h-4 w-4 text-orange-400" fill="none" viewBox="0 0 24 24">
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
        <p className="text-xs text-rose-400 bg-rose-950/20 py-2 px-3 rounded-[var(--radius-sm)] border border-rose-900/30">
          {error}
        </p>
      )}

      {/* Add Document Box */}
      <div className="p-4 rounded-[var(--radius-md)] bg-zinc-900/40 border border-zinc-800/80 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">上传或关联新文件</p>
          <button
            type="button"
            onClick={() => setAdding(v => !v)}
            className={`p-1.5 rounded-[var(--radius-sm)] text-zinc-400 hover:text-white border smooth-transition ${
              adding ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'
            }`}
          >
            {adding ? <X size={13} /> : <Plus size={13} />}
          </button>
        </div>
        {adding && (
          <div className="pt-2 border-t border-zinc-800/40">
            <AddDocPanel classCode={classCode} onAdd={handleAdd} onClose={() => setAdding(false)} />
          </div>
        )}
      </div>

      {/* Active Links List */}
      {links.length === 0 ? (
        <p className="text-xs text-zinc-500 italic text-center py-6 bg-zinc-900/40 rounded-[var(--radius-md)] border border-zinc-800">
          暂无已关联文件。
        </p>
      ) : (
        <div className="relative space-y-3">
          <TagFilterBar tags={classTags} active={activeTag} onSelect={setActiveTag} />
          {visibleLinks.length === 0 && (
            <p className="text-xs text-zinc-500 italic text-center py-6 bg-zinc-900/40 rounded-[var(--radius-md)] border border-zinc-800">
              「{activeTag}」分类下暂无文件。
            </p>
          )}
          <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleLinks.map(l => l.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {visibleLinks.map(link => {
                  const isExternal = !link.id.startsWith('r2:')
                  const sizeMb = link.size ? Math.round(link.size / (1024 * 1024)) : null
                  const isEditing = editingId === link.id
                  const dragDisabled = activeTag !== null || isEditing
                  return (
                    <SortableLinkItem
                      key={link.id}
                      id={link.id}
                      disabled={dragDisabled}
                      className={`p-3.5 rounded-[var(--radius-md)] border transition-all duration-200 bg-zinc-900/30 hover:bg-zinc-900/50 ${
                        isEditing ? 'border-orange-500/40' : 'border-zinc-800/80'
                      } space-y-3 group`}
                    >
                      {({ attributes, listeners }) => (
                        <>
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              {...attributes}
                              {...listeners}
                              disabled={dragDisabled}
                              title={activeTag !== null ? '清除筛选后可拖拽排序' : '拖拽排序'}
                              className="shrink-0 mt-1.5 p-1 -ml-1 rounded text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing touch-none disabled:opacity-20 disabled:pointer-events-none smooth-transition"
                              aria-label="拖拽排序"
                            >
                              <GripVertical size={14} />
                            </button>
                            <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
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
                                    className="w-full px-3 py-2 text-sm rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-orange-500 transition-all"
                                    placeholder="文件标题"
                                  />
                                  <input
                                    type="url"
                                    value={editUrl}
                                    onChange={e => setEditUrl(e.target.value)}
                                    disabled={!isExternal}
                                    className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 text-zinc-300 disabled:opacity-50 focus:outline-none focus:border-orange-500 transition-all"
                                    placeholder="链接地址"
                                  />
                                  <TagPicker value={editTags} onChange={setEditTags} suggestions={classTags} />
                                </div>
                              ) : (
                                <div className="pt-0.5 space-y-1.5">
                                  <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">{link.title}</p>
                                  <p className="text-[10px] text-zinc-500 font-mono tracking-wider flex items-center gap-1">
                                    {isExternal ? <><Link2 size={10} className="opacity-60" />{hostOf(link.url)}</> : <>{sizeMb} MB</>}
                                  </p>
                                  <TagBadges tags={link.tags} />
                                </div>
                              )}
                            </div>
                            <div className="shrink-0">
                              {isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => handleSave(link)}
                                  disabled={busy}
                                  className="p-2 rounded-[var(--radius-sm)] bg-orange-600/20 text-orange-400 hover:bg-orange-600 hover:text-white smooth-transition"
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
                                  className="p-2 rounded-[var(--radius-sm)] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 smooth-transition border border-transparent hover:border-zinc-700/50"
                                  aria-label="Actions"
                                >
                                  <EllipsisVertical size={14} />
                                </button>
                              )}
                            </div>
                          </div>

                          {isEditing && (
                            <div className="flex justify-end gap-3 border-t border-zinc-800/40 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null)
                                  setEditTitle('')
                                  setEditUrl('')
                                  setEditTags([])
                                }}
                                className="text-xs font-semibold text-zinc-500 hover:text-zinc-300"
                              >
                                取消
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </SortableLinkItem>
                  )
                })}
              </ul>
            </SortableContext>
          </DndContext>

          {/* Floating actions dropdown menu (mobile accessible) */}
          {menuLink && contextMenu && (
            <div
              className="fixed z-[100] w-40 rounded-[var(--radius-sm)] border border-zinc-800/80 bg-zinc-950 shadow-2xl overflow-hidden p-1 animate-scale-up"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={e => e.stopPropagation()}
            >
              <button type="button" onClick={() => startEdit(menuLink)} className="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900 rounded-[var(--radius-sm)] flex items-center gap-2 smooth-transition">
                <Pencil size={13} className="text-orange-400" />
                <span>编辑文件</span>
              </button>
              <button type="button" onClick={() => openCopyDialog(menuLink)} disabled={copyTargets.length === 0} className="w-full px-3 py-2 text-left text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900 disabled:opacity-30 rounded-[var(--radius-sm)] flex items-center gap-2 smooth-transition">
                <Copy size={13} className="text-blue-400" />
                <span>复制到其他班</span>
              </button>
              <button type="button" onClick={() => handleRemove(menuLink.id)} className="w-full px-3 py-2 text-left text-xs font-bold text-rose-400 hover:bg-rose-950/20 rounded-[var(--radius-sm)] flex items-center gap-2 smooth-transition border-t border-zinc-900/50 mt-1">
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
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-300 smooth-transition"
          >
            <ShieldAlert size={13} />
            <span>{showHidden ? '收起' : '展开'}已隐藏文件 ({hiddenLinks.length})</span>
          </button>
          
          {showHidden && (
            <ul className="space-y-1.5">
              {hiddenLinks.map(link => (
                <li key={link.id} className="flex items-center justify-between px-3 py-3 rounded-[var(--radius-md)] bg-zinc-950/60 border border-zinc-800 p-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 text-zinc-600">
                      {link.kind === 'pdf' ? <FileText size={14} /> : <Presentation size={14} />}
                    </div>
                    <span className="text-xs text-zinc-500 truncate max-w-[200px]">{link.title}</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestore(link.id)}
                      className="p-1.5 rounded-[var(--radius-sm)] text-zinc-500 hover:text-orange-400 hover:bg-zinc-900 smooth-transition"
                      title="恢复此文件"
                    >
                      <RotateCcw size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurge(link.id)}
                      className="p-1.5 rounded-[var(--radius-sm)] text-zinc-500 hover:text-rose-500 hover:bg-zinc-900 smooth-transition"
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
          <div className="w-full max-w-sm rounded-[var(--radius-md)] border border-zinc-800 bg-zinc-950 p-5 space-y-4 shadow-2xl animate-scale-up">
            <div>
              <h3 className="text-sm font-bold text-white">复制此文件到其他班级</h3>
              <p className="text-xs text-zinc-500 truncate mt-1">{copyingLink.title}</p>
            </div>
            <select
              value={copyTargetCode}
              onChange={e => setCopyTargetCode(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-[var(--radius-sm)] bg-zinc-900 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-orange-500 transition-all"
            >
              <option value="">-- 选择目标班级 --</option>
              {copyTargets.map(cls => (
                <option key={cls.code} value={cls.code}>
                  {cls.name} ({cls.code})
                </option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-3 border-t border-zinc-900 pt-3">
              <button
                type="button"
                onClick={() => {
                  setCopyingLink(null)
                  setCopyTargetCode('')
                }}
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCopyToClass}
                disabled={busy || !copyTargetCode}
                className="px-4 py-2 text-xs rounded-[var(--radius-sm)] bg-orange-600 hover:bg-orange-500 text-white font-bold disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] transition-all duration-200"
              >
                {busy ? '复制中...' : '确认复制'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] px-4 py-3 rounded-[var(--radius-sm)] bg-zinc-900 border border-orange-500/30 text-white text-xs font-semibold shadow-2xl flex items-center gap-2">
          <Check size={14} className="text-orange-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}

// ── SharedLibraryManager Component ────────────────────────────────────────────

interface LibraryOwner {
  code: string
  name: string
  id: string
  hidden?: boolean
}

type LibraryItem = ShowLink & { owners: LibraryOwner[] }

// ── 定课 script variants ────────────────────────────────────────────────────
// A variant is a full independent section list a class can be assigned to —
// for classes whose 定课 genuinely differs (different sections, not just
// different wording on the built-in ten). Editing a variant here changes it
// for every class assigned to it; a class can still layer its own quick edits
// on top via the in-panel pencil editor (that continues to work unchanged —
// it just resolves against the assigned variant's sections instead of the
// default ones).

const AUDIO_OPTIONS: Array<{ value: '' | keyof typeof DINGKE_AUDIO; label: string }> = [
  { value: '', label: '无音频' },
  { value: 'opening', label: `${DINGKE_AUDIO.opening.label}（共享音轨）` },
  { value: 'cijing', label: `${DINGKE_AUDIO.cijing.label}（共享音轨）` },
]

function audioKeyOf(section: DingkeSection): '' | keyof typeof DINGKE_AUDIO {
  if (!section.audio) return ''
  const match = (Object.keys(DINGKE_AUDIO) as Array<keyof typeof DINGKE_AUDIO>)
    .find(k => DINGKE_AUDIO[k].src === section.audio!.src)
  return match ?? ''
}

function slugify(title: string): string {
  const base = title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  return base || 'section'
}

function uniqueSectionId(title: string, existingIds: string[]): string {
  const base = slugify(title)
  if (!existingIds.includes(base)) return base
  let n = 2
  while (existingIds.includes(`${base}-${n}`)) n++
  return `${base}-${n}`
}

function blankSection(existingIds: string[]): DingkeSection {
  return {
    id: uniqueSectionId('新环节', existingIds),
    title: '新环节',
    slide: { lines: [] },
    blocks: [],
  }
}

/** Slide-over editor for one section within a variant's local (unsaved) buffer. */
function DingkeVariantSectionEditor({
  section, onSave, onClose,
}: {
  section: DingkeSection
  onSave: (next: DingkeSection) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(section.title)
  const [subtitle, setSubtitle] = useState(section.subtitle ?? '')
  const [kicker, setKicker] = useState(section.slide.kicker ?? '')
  const [slideLines, setSlideLines] = useState(section.slide.lines.join('\n'))
  const [body, setBody] = useState(blocksToBody(section.blocks))
  const [audioKey, setAudioKey] = useState<'' | keyof typeof DINGKE_AUDIO>(audioKeyOf(section))
  const [audioFirst, setAudioFirst] = useState(Boolean(section.audioFirst))
  const [videoSrc, setVideoSrc] = useState(section.video?.src ?? '')
  const [videoLabel, setVideoLabel] = useState(section.video?.label ?? '')
  const [videoDurationMin, setVideoDurationMin] = useState(section.video ? String(Math.round(section.video.durationSec / 60)) : '')

  const field = 'w-full px-3.5 py-2.5 text-sm rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500/80 smooth-transition'
  const label = 'block text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5'

  function save() {
    if (!title.trim()) return
    const src = videoSrc.trim()
    onSave({
      ...section,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      slide: { kicker: kicker.trim() || undefined, lines: slideLines.split('\n').map(l => l.trim()).filter(Boolean) },
      blocks: parseBody(body),
      audio: audioKey ? DINGKE_AUDIO[audioKey] : undefined,
      audioFirst: audioKey ? audioFirst : undefined,
      video: src ? {
        src,
        label: videoLabel.trim() || '开示视频',
        durationSec: (parseInt(videoDurationMin) || 0) * 60,
      } : undefined,
    })
  }

  const previewSlide = {
    kicker: kicker.trim() || undefined,
    lines: slideLines.split('\n').map(l => l.trim()).filter(Boolean),
  }
  // A fixed logical canvas (16:9) rendered at a small zoom, then visually
  // scaled down as a whole — SlidePane sizes its type off real viewport vh,
  // so shrinking only via CSS width would leave text oversized for the box;
  // the canvas has to be laid out small to begin with.
  const previewCanvasW = 640
  const previewCanvasH = 360
  const previewBoxW = 320
  const previewScale = previewBoxW / previewCanvasW

  return (
    <div className="absolute inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-stretch justify-end">
      <div className="w-full max-w-3xl h-full bg-zinc-950 border-l border-zinc-800 flex flex-col">
        <header className="shrink-0 px-5 py-4 border-b border-zinc-800/80 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white">编辑环节</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">id: {section.id}</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white smooth-transition" aria-label="关闭">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 min-h-0 flex">
          {/* Live preview — what the shared screen actually shows, updating as the fields change. */}
          <div className="hidden md:flex w-[22rem] shrink-0 border-r border-zinc-800/80 flex-col gap-3 p-5 bg-black/10 overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">大字页面预览</p>
            <div
              className="rounded-[var(--radius-sm)] overflow-hidden border border-zinc-800 shrink-0"
              style={{ width: previewBoxW, height: previewCanvasH * previewScale }}
            >
              <div
                style={{ width: previewCanvasW, height: previewCanvasH, transform: `scale(${previewScale})`, transformOrigin: 'top left' }}
              >
                <SlidePane slide={previewSlide} zoom={0.42} sectionId={section.id} direction={1} />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              这是主持人共享给全班的画面，念诵稿在旁边的手机上单独显示。
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className={label}>环节名称</label>
            <input className={field} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={label}>副标题</label>
            <input className={field} value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="可留空" />
          </div>
          <div>
            <label className={label}>大字页面小标题</label>
            <input className={field} value={kicker} onChange={e => setKicker(e.target.value)} placeholder="可留空，如「禅修」" />
          </div>
          <div>
            <label className={label}>大字内容（每行一句）</label>
            <textarea
              className={`${field} font-mono text-xs leading-relaxed`}
              rows={5}
              value={slideLines}
              onChange={e => setSlideLines(e.target.value)}
            />
            <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
              以 <code className="text-zinc-400">#</code> 开头的行显示为橙色小标题，可把一页分成几组。
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
            <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
              空行分段。以「主持人白」开头的段落显示为绿色提示；以「※」开头显示为备注；
              <code className="text-zinc-400">{'{{回向名单}}'}</code> 会替换成本班当周的回向名单。
            </p>
          </div>
          <div>
            <label className={label}>音频</label>
            <select
              className={field}
              value={audioKey}
              onChange={e => setAudioKey(e.target.value as '' | keyof typeof DINGKE_AUDIO)}
            >
              {AUDIO_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {audioKey && (
              <label className="flex items-center gap-2 mt-2 text-xs text-zinc-400">
                <input type="checkbox" checked={audioFirst} onChange={e => setAudioFirst(e.target.checked)} />
                <span>音频显示在念诵稿上方（适合开场音乐）</span>
              </label>
            )}
          </div>
          <div>
            <label className={label}>视频（如法师开示，播放器显示在大字页面）</label>
            <input
              className={`${field} font-mono text-xs`}
              placeholder="视频链接 https://…"
              value={videoSrc}
              onChange={e => setVideoSrc(e.target.value)}
            />
            {videoSrc.trim() && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  className={field}
                  placeholder="视频标题（如：皈依开示）"
                  value={videoLabel}
                  onChange={e => setVideoLabel(e.target.value)}
                />
                <input
                  className={field}
                  type="number"
                  min={0}
                  placeholder="时长（分钟）"
                  value={videoDurationMin}
                  onChange={e => setVideoDurationMin(e.target.value)}
                />
              </div>
            )}
          </div>
          </div>
        </div>

        <footer className="shrink-0 px-5 py-4 border-t border-zinc-800/80 flex items-center gap-2">
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-[var(--radius-sm)] border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 smooth-transition"
          >
            取消
          </button>
          <button
            onClick={save}
            disabled={!title.trim()}
            className="px-5 py-2.5 rounded-[var(--radius-sm)] bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold active:scale-[0.98] smooth-transition disabled:opacity-40 disabled:pointer-events-none"
          >
            完成
          </button>
        </footer>
      </div>
    </div>
  )
}

function DingkeVariantsManager({
  password,
  variants,
  classes,
  onChanged,
}: {
  password: string
  variants: DingkeVariant[]
  classes: ClassInfo[]
  onChanged: () => Promise<void>
}) {
  // 'default' is a read-only view of the built-in script (baked into
  // dingke-content.ts, not stored in R2) — it can be viewed and forked into a
  // real editable variant, but not saved in place or deleted.
  const [editingId, setEditingId] = useState<string | 'new' | 'default' | null>(null)
  const [name, setName] = useState('')
  const [sections, setSections] = useState<DingkeSection[]>([])
  const [startFrom, setStartFrom] = useState<'' | 'default' | string>('')
  const [editingSectionIndex, setEditingSectionIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function resetForm() {
    setEditingId(null)
    setName('')
    setSections([])
    setStartFrom('')
    setEditingSectionIndex(null)
    setError(null)
  }

  function startNew() {
    setEditingId('new')
    setName('')
    setSections([])
    setStartFrom('')
    setError(null)
  }

  function startEdit(variant: DingkeVariant) {
    setEditingId(variant.id)
    setName(variant.name)
    setSections(variant.sections)
    setError(null)
  }

  function viewDefault() {
    setEditingId('default')
    setName('默认脚本')
    setSections(DEFAULT_DINGKE_SECTIONS.map(s => ({ ...s })))
    setError(null)
  }

  /** Turns the read-only default view into a real, editable, savable copy. */
  function forkDefaultToNew() {
    setEditingId('new')
    setName('默认脚本副本')
    setStartFrom('default')
    setError(null)
  }

  function applyStartFrom(value: string) {
    setStartFrom(value)
    if (value === 'default') setSections(DEFAULT_DINGKE_SECTIONS.map(s => ({ ...s })))
    else if (value) {
      const source = variants.find(v => v.id === value)
      if (source) setSections(source.sections.map(s => ({ ...s })))
    } else {
      setSections([])
    }
  }

  function addSection() {
    setSections(prev => [...prev, blankSection(prev.map(s => s.id))])
  }

  function removeSection(index: number) {
    setSections(prev => prev.filter((_, i) => i !== index))
  }

  const sectionDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSections(prev => {
      const oldIndex = prev.findIndex(s => s.id === active.id)
      const newIndex = prev.findIndex(s => s.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  async function handleSave() {
    if (!name.trim() || sections.length === 0) return
    setBusy(true)
    setError(null)
    try {
      await adminPost(password, {
        action: 'saveDingkeVariant',
        id: editingId === 'new' ? undefined : editingId,
        name: name.trim(),
        sections,
      })
      resetForm()
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存版本失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(variant: DingkeVariant) {
    const assigned = classes.filter(c => c.dingkeVariantId === variant.id)
    const warning = assigned.length
      ? `确定删除「${variant.name}」？${assigned.length} 个班级（${assigned.map(c => c.name).join('、')}）将改回使用默认定课脚本。`
      : `确定删除「${variant.name}」？`
    if (!confirm(warning)) return
    try {
      await adminPost(password, { action: 'deleteDingkeVariant', id: variant.id })
      if (editingId === variant.id) resetForm()
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除版本失败')
    }
  }

  const field = 'w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500'

  if (editingId) {
    const isDefaultView = editingId === 'default'
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Sparkles size={16} className="text-orange-400" />
              <span>
                {isDefaultView ? '默认脚本（内置）' : editingId === 'new' ? '新建定课版本' : `编辑「${name}」`}
              </span>
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {isDefaultView
                ? '写在代码里的内置脚本，只读；改环节请先复制为新版本。'
                : '完整独立脚本，环节可自由增删排序，与默认脚本互不影响。'}
            </p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 smooth-transition"
          >
            返回列表
          </button>
        </div>

        {!isDefaultView && (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">版本名称</label>
              <input
                className={field}
                placeholder="如：进阶班定课"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            {editingId === 'new' && (
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1.5">起始内容</label>
                <select className={field} value={startFrom} onChange={e => applyStartFrom(e.target.value)}>
                  <option value="">空白（自行添加环节）</option>
                  <option value="default">默认定课脚本（10 个环节）</option>
                  {variants.map(v => <option key={v.id} value={v.id}>复制自「{v.name}」</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-400 bg-rose-950/20 py-2 px-4 rounded-[var(--radius-sm)] border border-rose-900/30">{error}</p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">环节（{sections.length}）</p>
            {!isDefaultView && (
              <button
                type="button"
                onClick={addSection}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[11px] font-bold text-orange-400 hover:bg-orange-950/30 smooth-transition"
              >
                <Plus size={12} /> <span>添加环节</span>
              </button>
            )}
          </div>
          {sections.length === 0 && (
            <p className="px-3 py-6 text-xs text-zinc-500 italic text-center border border-dashed border-zinc-800 rounded-[var(--radius-sm)]">
              暂无环节，从上方选择起始内容或点击「添加环节」。
            </p>
          )}
          <DndContext sensors={sectionDragSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1.5">
                {sections.map((section, i) => (
                  <SortableLinkItem
                    key={section.id}
                    id={section.id}
                    disabled={isDefaultView}
                    className="flex items-center gap-2 p-2.5 rounded-[var(--radius-sm)] border border-zinc-800 bg-zinc-950/40"
                  >
                    {({ attributes, listeners }) => (
                      <>
                        {!isDefaultView && (
                          <button
                            type="button"
                            {...attributes}
                            {...listeners}
                            className="shrink-0 p-1 -ml-1 rounded text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing touch-none smooth-transition"
                            aria-label="拖拽排序"
                          >
                            <GripVertical size={14} />
                          </button>
                        )}
                        <span className="text-[10px] font-mono text-zinc-600 w-5 text-center shrink-0">{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => !isDefaultView && setEditingSectionIndex(i)}
                          disabled={isDefaultView}
                          className="flex-1 min-w-0 text-left disabled:cursor-default"
                        >
                          <p className="text-xs font-bold text-white truncate">{section.title}</p>
                          <p className="text-[10px] text-zinc-500 truncate font-mono">
                            {section.id}{section.audio ? ' · 音频' : ''}{section.video ? ' · 视频' : ''}
                          </p>
                        </button>
                        {!isDefaultView && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button type="button" onClick={() => setEditingSectionIndex(i)} className="p-1.5 rounded-[var(--radius-sm)] text-zinc-500 hover:text-white hover:bg-zinc-900" aria-label="编辑">
                              <Pencil size={13} />
                            </button>
                            <button type="button" onClick={() => removeSection(i)} className="p-1.5 rounded-[var(--radius-sm)] text-zinc-500 hover:text-rose-500 hover:bg-rose-950/20" aria-label="删除">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </SortableLinkItem>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>

        <div className="flex gap-2 pt-2">
          {isDefaultView ? (
            <button
              type="button"
              onClick={forkDefaultToNew}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-[var(--radius-sm)] bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold active:scale-[0.98] transition-all"
            >
              <Copy size={13} />
              <span>复制为新版本</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !name.trim() || sections.length === 0}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-[var(--radius-sm)] bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              <Save size={13} />
              <span>{busy ? '保存中…' : '保存版本'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2.5 text-xs font-bold rounded-[var(--radius-sm)] border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            {isDefaultView ? '返回' : '取消'}
          </button>
        </div>

        {!isDefaultView && editingSectionIndex !== null && sections[editingSectionIndex] && (
          <DingkeVariantSectionEditor
            section={sections[editingSectionIndex]}
            onClose={() => setEditingSectionIndex(null)}
            onSave={next => {
              setSections(prev => prev.map((s, i) => i === editingSectionIndex ? next : s))
              setEditingSectionIndex(null)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-orange-400" />
            <span>定课版本</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            管理不同班级使用的定课脚本。默认脚本（{DEFAULT_DINGKE_SECTIONS.length} 个环节）始终可用；未指定版本的班级自动使用它。
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold active:scale-[0.98] smooth-transition"
        >
          <Plus size={13} /> <span>新建版本</span>
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-400 bg-rose-950/20 py-2 px-4 rounded-[var(--radius-sm)] border border-rose-900/30">{error}</p>
      )}

      <ul className="space-y-8">
        {/* The built-in script isn't a real DingkeVariant (it's code, not R2
            state) — shown as its own row so it's visible alongside custom
            versions, but read-only: view its sections or fork a copy. */}
        {(() => {
          const defaultAssigned = classes.filter(c => !c.dingkeVariantId)
          return (
            <li className="p-4 rounded-[var(--radius-md)] border border-zinc-800 bg-zinc-950/40 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>默认脚本</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-zinc-800 text-zinc-300 font-bold shrink-0">内置</span>
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {DEFAULT_DINGKE_SECTIONS.length} 个环节 ·{' '}
                    {defaultAssigned.length
                      ? `未指定版本的 ${defaultAssigned.length} 个班级使用：${defaultAssigned.map(c => c.name).join('、')}`
                      : '暂无班级使用'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={viewDefault}
                    className="p-1.5 rounded-[var(--radius-sm)] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
                    aria-label="查看默认脚本"
                    title="查看"
                  >
                    <Eye size={13} />
                  </button>
                </div>
              </div>
            </li>
          )
        })()}
        {variants.length === 0 && (
          <li className="px-3 py-6 text-xs text-zinc-500 italic text-center">暂无自定义版本，其余班级使用默认脚本。</li>
        )}
        {variants.map(variant => {
          const assigned = classes.filter(c => c.dingkeVariantId === variant.id)
          return (
            <li key={variant.id} className="p-4 rounded-[var(--radius-md)] border border-zinc-800 bg-zinc-950/40 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{variant.name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {variant.sections.length} 个环节 ·{' '}
                    {assigned.length ? `已关联 ${assigned.length} 个班级：${assigned.map(c => c.name).join('、')}` : '暂无班级关联'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(variant)}
                    className="p-1.5 rounded-[var(--radius-sm)] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
                    aria-label="编辑版本"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(variant)}
                    className="p-1.5 rounded-[var(--radius-sm)] text-zinc-500 hover:text-rose-500 hover:bg-rose-950/20"
                    aria-label="删除版本"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SharedLibraryManager({ password }: { password: string }) {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyUrl, setBusyUrl] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [editingUrl, setEditingUrl] = useState<string | null>(null)
  const [editTags, setEditTags] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminPost(password, { action: 'listLibraryAll' })
      setItems(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载共享库失败')
    } finally {
      setLoading(false)
    }
  }, [password])

  useEffect(() => { load() }, [load])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2000)
  }

  function startEditTags(item: LibraryItem) {
    setEditingUrl(item.url)
    setEditTags(item.tags ?? [])
    setError(null)
  }

  // A doc can have several owning classes (each with its own stored copy of
  // the same url) — editing tags here writes the same tag set to every
  // owner's copy in one go, since 共享库 treats "the file" as one thing
  // regardless of how many classes hold it.
  async function handleSaveTags(item: LibraryItem) {
    setBusyUrl(item.url)
    setError(null)
    try {
      await Promise.all(item.owners.map(o => adminPost(password, {
        action: 'updateLink',
        code: o.code,
        link: { id: o.id, tags: editTags.length ? editTags : undefined },
      })))
      setEditingUrl(null)
      setEditTags([])
      showToast('标签已更新')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新标签失败')
    } finally {
      setBusyUrl(null)
    }
  }

  async function handleDelete(item: LibraryItem) {
    const classNames = item.owners.map(o => o.name).join('、')
    if (!confirm(`确定从共享库中彻底删除「${item.title}」？此文件将从「${classNames}」共 ${item.owners.length} 个班级中移除，且无法恢复！`)) return
    setBusyUrl(item.url)
    try {
      await Promise.all(item.owners.map(o => adminPost(password, { action: 'purgeLink', code: o.code, id: o.id })))
      setItems(prev => prev.filter(l => l.url !== item.url))
      showToast('文件已从共享库彻底删除')
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setBusyUrl(null)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="border-b border-zinc-800/60 pb-4">
        <h2 className="text-lg font-extrabold text-white tracking-wide flex items-center gap-2">
          <Library size={18} className="text-orange-400" />
          <span>共享库</span>
        </h2>
        <p className="text-xs font-semibold text-zinc-500 mt-1">
          管理所有班级当前使用中的文件，可在此彻底删除以从云存储中移除
        </p>
      </div>

      {error && (
        <p className="text-xs text-rose-400 bg-rose-950/20 py-2 px-4 rounded-[var(--radius-sm)] border border-rose-900/30">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-zinc-500 text-sm gap-2">
          <svg className="animate-spin h-5 w-5 text-orange-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>正在载入共享库...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-[var(--radius-md)] border border-zinc-800/80 bg-zinc-900/30">
          <p className="text-zinc-500 text-sm italic">目前没有任何班级使用中的文件。</p>
        </div>
      ) : (
        <div className="space-y-3">
          <TagFilterBar tags={allTagsOf(items)} active={activeTag} onSelect={setActiveTag} />
          {(() => {
            const visible = activeTag ? items.filter(i => (i.tags ?? []).includes(activeTag)) : items
            if (visible.length === 0) {
              return (
                <p className="text-xs text-zinc-500 italic text-center py-6 bg-zinc-900/40 rounded-[var(--radius-md)] border border-zinc-800">
                  「{activeTag}」分类下暂无文件。
                </p>
              )
            }
            return (
              <ul className="space-y-1.5">
                {visible.map(item => {
                  const allHidden = item.owners.every(o => o.hidden)
                  const isEditing = editingUrl === item.url
                  return (
                  <li
                    key={item.url}
                    className={`p-3 rounded-[var(--radius-md)] border smooth-transition space-y-2.5 ${
                      isEditing ? 'border-orange-500/40 bg-zinc-900/50' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0 text-zinc-500">
                          {item.kind === 'pdf' ? <FileText size={15} /> : item.kind === 'video' ? <FileText size={15} /> : <Presentation size={15} />}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium text-zinc-200 truncate max-w-[320px] flex items-center gap-1.5">
                            <span className="truncate">{item.title}</span>
                            {allHidden && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-400">全部隐藏</span>
                            )}
                          </p>
                          <p className="text-[10px] text-zinc-500 font-mono tracking-wide truncate">
                            {item.owners.map(o => o.hidden ? `${o.name}（已隐藏）` : o.name).join('、')}
                            <span className="text-zinc-600"> · {item.owners.length} 个班级</span>
                          </p>
                          {!isEditing && <TagBadges tags={item.tags} />}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => isEditing ? setEditingUrl(null) : startEditTags(item)}
                          disabled={busyUrl === item.url}
                          className="p-2 rounded-[var(--radius-sm)] text-zinc-500 hover:text-orange-400 hover:bg-orange-950/20 disabled:opacity-30 smooth-transition"
                          title="编辑标签"
                        >
                          <Tag size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={busyUrl === item.url}
                          className="p-2 rounded-[var(--radius-sm)] text-zinc-500 hover:text-rose-500 hover:bg-rose-950/20 disabled:opacity-30 smooth-transition"
                          title="从共享库彻底删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="space-y-2 border-t border-zinc-800/40 pt-2.5">
                        <TagPicker value={editTags} onChange={setEditTags} suggestions={allTagsOf(items)} />
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                          将同步更新到全部 {item.owners.length} 个关联班级。
                        </p>
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => { setEditingUrl(null); setEditTags([]) }}
                            className="text-xs font-semibold text-zinc-500 hover:text-zinc-300"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveTags(item)}
                            disabled={busyUrl === item.url}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--radius-sm)] bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold disabled:opacity-40 smooth-transition"
                          >
                            <Save size={12} />
                            <span>{busyUrl === item.url ? '保存中…' : '保存'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                  )
                })}
              </ul>
            )
          })()}
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] px-4 py-3 rounded-[var(--radius-sm)] bg-zinc-900 border border-orange-500/30 text-white text-xs font-semibold shadow-2xl flex items-center gap-2">
          <Check size={14} className="text-orange-400" />
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
  const [dingkeVariants, setDingkeVariants] = useState<DingkeVariant[]>([])
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showDingkeVariants, setShowDingkeVariants] = useState(false)
  const [addingClass, setAddingClass] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [classError, setClassError] = useState<string | null>(null)
  const [classBusy, setClassBusy] = useState(false)
  const [editingClassCode, setEditingClassCode] = useState<string | null>(null)
  const [editClassName, setEditClassName] = useState('')

  // Per-class sign-in link — loaded fresh whenever the selected class changes,
  // not part of the classes list itself (mirrors how the class's own page
  // fetches it separately from /api/classes).
  const [classSignin, setClassSignin] = useState<ClassSignin | null>(null)
  const [signinEditing, setSigninEditing] = useState(false)
  const [signinUrl, setSigninUrl] = useState('')
  const [signinPasscode, setSigninPasscode] = useState('')
  const [signinBusy, setSigninBusy] = useState(false)
  const [signinError, setSigninError] = useState<string | null>(null)

  const selectedClass = classes.find(c => c.code === selectedCode) ?? null

  const loadClasses = useCallback(async (pw: string) => {
    const data = await adminPost(pw, { action: 'listClasses' })
    setClasses(Array.isArray(data) ? data : [])
  }, [])

  const loadDingkeVariants = useCallback(async (pw: string) => {
    const data = await adminPost(pw, { action: 'listDingkeVariants' })
    setDingkeVariants(Array.isArray(data) ? data : [])
  }, [])

  // The variants manager shows class assignments, and the class panel shows
  // the assigned variant, so both are refreshed together after any change.
  const reloadAll = useCallback(async () => {
    await Promise.all([loadClasses(password), loadDingkeVariants(password)])
  }, [loadClasses, loadDingkeVariants, password])

  const loadClassSignin = useCallback(async (code: string, pw: string) => {
    try {
      const data = await adminPost(pw, { action: 'getClassSignin', code })
      setClassSignin(data ?? null)
    } catch {
      setClassSignin(null)
    }
  }, [])

  useEffect(() => {
    setSigninEditing(false)
    setSigninError(null)
    if (selectedCode) loadClassSignin(selectedCode, password)
    else setClassSignin(null)
  }, [selectedCode, password, loadClassSignin])

  function startEditSignin() {
    setSigninUrl(classSignin?.url ?? '')
    setSigninPasscode(classSignin?.passcode ?? '')
    setSigninError(null)
    setSigninEditing(true)
  }

  async function handleSaveSignin() {
    if (!selectedCode) return
    setSigninBusy(true)
    setSigninError(null)
    try {
      const data = await adminPost(password, {
        action: 'saveClassSignin',
        code: selectedCode,
        url: signinUrl,
        passcode: signinPasscode,
      })
      setClassSignin(data ?? null)
      setSigninEditing(false)
    } catch (e) {
      setSigninError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSigninBusy(false)
    }
  }

  async function handleClearSignin() {
    if (!selectedCode) return
    if (!confirm('确定清除本班签到链接？清除后本班将暂无签到二维码，直到重新设置。')) return
    setSigninBusy(true)
    setSigninError(null)
    try {
      await adminPost(password, { action: 'clearClassSignin', code: selectedCode })
      setClassSignin(null)
    } catch (e) {
      setSigninError(e instanceof Error ? e.message : '清除失败')
    } finally {
      setSigninBusy(false)
    }
  }

  async function handleAssignDingkeVariant(cls: ClassInfo, variantId: string) {
    setClassBusy(true)
    setClassError(null)
    try {
      await adminPost(password, {
        action: 'updateClass',
        code: cls.code,
        name: cls.name,
        createdAt: cls.createdAt,
        dingkeVariantId: variantId || undefined,
      })
      await loadClasses(password)
    } catch (e) {
      setClassError(`关联定课版本失败：${e instanceof Error ? e.message : '未知错误'}`)
    } finally {
      setClassBusy(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthBusy(true)
    setAuthError(null)
    try {
      await loadClasses(password)
      await loadDingkeVariants(password)
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
      setAddingClass(false)
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
        dingkeVariantId: cls.dingkeVariantId,
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
        <div className="w-full max-w-sm space-y-8 z-10">
          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-[var(--radius-sm)] bg-zinc-800 flex items-center justify-center text-orange-400">
              <Shield size={24} />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-white">管理后台</h1>
              <p className="text-xs text-zinc-400">请输入管理员密码进行登录</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="管理员密码"
              autoFocus
              className="w-full px-4 py-3 rounded-[var(--radius-sm)] bg-zinc-800/70 border border-transparent text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-all"
            />
            {authError && (
              <p className="text-xs text-rose-450 bg-rose-950/20 py-1.5 px-3 rounded-[var(--radius-sm)] border border-rose-900/30 text-center">
                {authError}
              </p>
            )}
            <button
              type="submit"
              disabled={authBusy || !password}
              className="w-full py-3 rounded-[var(--radius-sm)] bg-orange-600 hover:bg-orange-500 text-white font-bold active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all duration-200"
            >
              {authBusy ? '登录验证中...' : '登录后台'}
            </button>
          </form>

          <p className="text-center">
            <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300 smooth-transition">← 返回首页</a>
          </p>
        </div>
      </main>
    )
  }

  // ── Admin dashboard ───────────────────────────────────────────────────────

  return (
    <main className="h-screen bg-zinc-955 text-zinc-100 premium-glow-bg flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
            <Shield size={16} className="text-orange-400" />
            <span>管理中心</span>
          </h1>
          <p className="text-[10px] text-zinc-500 font-medium tracking-wide">大道大商 . 共修平台班级与文件管理后台</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-xs font-semibold text-zinc-400 hover:text-white smooth-transition">首页</a>
          <button 
            onClick={() => setAuthed(false)} 
            className="flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-rose-400 smooth-transition"
          >
            <LogOut size={12} />
            <span>注销</span>
          </button>
        </div>
      </header>

      {/* Main columns */}
      <div className="flex flex-1 min-h-0">
        {/* Class list sidebar */}
        <aside className="w-80 shrink-0 border-r border-zinc-800/80 flex flex-col bg-zinc-950/40">
          {/* Global navigation */}
          <div className="p-2.5 border-b border-zinc-800/60 bg-zinc-950/20">
            <p className="px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2">全局管理</p>
            <button
              type="button"
              onClick={() => { setShowLibrary(true); setShowDingkeVariants(false); setSelectedCode(null) }}
              className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-[var(--radius-sm)] border smooth-transition ${
                showLibrary
                  ? 'bg-orange-600/15 border-orange-500/30 text-white'
                  : 'border-transparent text-zinc-300 hover:bg-zinc-900/50 hover:text-white'
              }`}
            >
              <Library size={15} className="shrink-0" />
              <span className="text-sm font-bold">共享库</span>
            </button>
            <button
              type="button"
              onClick={() => { setShowDingkeVariants(true); setShowLibrary(false); setSelectedCode(null) }}
              className={`w-full flex items-center gap-2.5 px-3 py-3 mt-1 rounded-[var(--radius-sm)] border smooth-transition ${
                showDingkeVariants
                  ? 'bg-orange-600/15 border-orange-500/30 text-white'
                  : 'border-transparent text-zinc-300 hover:bg-zinc-900/50 hover:text-white'
              }`}
            >
              <Sparkles size={15} className="shrink-0" />
              <span className="text-sm font-bold">定课版本</span>
            </button>
          </div>

          {/* Classes navigation list */}
          <div className="flex-1 overflow-y-auto p-2.5">
            <p className="px-3 text-[10px] uppercase font-bold tracking-wider text-zinc-500 mb-2">班级管理</p>
            <div className="flex items-center justify-between gap-2.5 px-3 py-3 mb-1 rounded-[var(--radius-sm)] text-zinc-300">
              <div className="flex items-center gap-2.5 min-w-0">
                <School size={15} className="shrink-0" />
                <span className="text-sm font-bold">已有班级 ({classes.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setAddingClass(v => !v)}
                className={`p-1 rounded-[var(--radius-sm)] smooth-transition shrink-0 ${
                  addingClass ? 'text-orange-400 bg-orange-950/40' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                }`}
                aria-label="添加班级"
                title="添加班级"
              >
                <Plus size={14} />
              </button>
            </div>

            {addingClass && (
              <form onSubmit={handleAddClass} className="space-y-2 mb-3 p-3 rounded-[var(--radius-sm)] border border-zinc-800 bg-zinc-950/60">
                <input
                  type="text"
                  placeholder="邀请码 (8位数字)"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={8}
                  autoFocus
                  className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 font-mono tracking-wider focus:outline-none focus:border-orange-500 transition-all"
                />
                <input
                  type="text"
                  placeholder="班级名称 (例如: 新大12班)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-all"
                />
                {classError && (
                  <p className="text-[10px] text-rose-400 bg-rose-950/20 py-1.5 px-3 rounded-[var(--radius-sm)] border border-rose-900/30">
                    {classError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={classBusy || !newCode.trim() || !newName.trim()}
                  className="w-full flex items-center justify-center gap-1 py-2 text-xs font-bold rounded-[var(--radius-sm)] bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  <Plus size={14} />
                  <span>添加班级</span>
                </button>
              </form>
            )}

            <ul className="space-y-1">
              {classes.length === 0 && (
                <li className="px-3 py-6 text-xs text-zinc-500 italic text-center">暂无班级。</li>
              )}
              {classes.map(cls => (
                <li key={cls.code}>
                  <div
                    className={`group/class flex items-center gap-2.5 px-3 py-3 rounded-[var(--radius-sm)] cursor-pointer border smooth-transition ${
                      selectedCode === cls.code 
                        ? 'bg-orange-600/15 border-orange-500/30 text-white' 
                        : 'border-transparent text-zinc-300 hover:bg-zinc-900/50 hover:text-white'
                    }`}
                    onClick={() => { setSelectedCode(cls.code); setShowLibrary(false); setShowDingkeVariants(false) }}
                  >
                    <div className="flex-1 min-w-0">
                      {editingClassCode === cls.code ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editClassName}
                            onChange={e => setEditClassName(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-full px-2 py-1 text-[11px] rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-orange-500"
                          />
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              handleSaveClassName(cls)
                            }}
                            disabled={classBusy}
                            className="p-1 rounded-[var(--radius-sm)] text-zinc-400 hover:text-orange-400 hover:bg-zinc-950 disabled:opacity-30"
                            aria-label="Save class name"
                          >
                            <Save size={12} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-bold truncate">{cls.name || cls.code}</p>
                      )}
                      <p className="text-[10px] text-zinc-500 font-mono tracking-wider mt-0.5">{cls.code}</p>
                    </div>
                    
                    {/* Hover actions */}
                    {editingClassCode !== cls.code && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          startEditClass(cls)
                        }}
                        className="opacity-100 md:opacity-0 md:group-hover/class:opacity-100 p-1.5 rounded-[var(--radius-sm)] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 smooth-transition shrink-0"
                        aria-label="Edit name"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                    <ChevronRight size={14} className={`shrink-0 transition-all ${selectedCode === cls.code ? 'opacity-100 text-orange-400' : 'opacity-0 group-hover/class:opacity-40'}`} />
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteClass(cls.code) }}
                      className="opacity-100 md:opacity-0 md:group-hover/class:opacity-100 p-1.5 rounded-[var(--radius-sm)] text-zinc-500 hover:text-rose-500 hover:bg-rose-950/20 smooth-transition shrink-0"
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
          {showDingkeVariants ? (
            <DingkeVariantsManager password={password} variants={dingkeVariants} classes={classes} onChanged={reloadAll} />
          ) : showLibrary ? (
            <SharedLibraryManager password={password} />
          ) : !selectedCode ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm gap-2">
              <School size={36} className="opacity-20" />
              <span>请从左侧列表选择一个班级来管理其关联的学习文档，或选择共享库</span>
            </div>
          ) : (
            <div className="max-w-xl space-y-6">
              <div className="flex justify-between items-start border-b border-zinc-800/60 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-white font-mono tracking-wider">{selectedCode}</h2>
                  <p className="text-xs font-semibold text-zinc-500 mt-1">
                    当前班级：{selectedClass?.name ?? selectedCode}
                  </p>
                </div>
                <a
                  href={`/class/${selectedCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-[var(--radius-sm)] border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 smooth-transition"
                >
                  预览班级前台
                </a>
              </div>
              
              {/* Per-class sign-in link — every class has its own, no shared
                  fallback. Editable here or by the class itself on its own
                  page; whichever saves last wins, same underlying record. */}
              <div className="p-4 rounded-[var(--radius-md)] border border-zinc-800 bg-zinc-950/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link2 size={13} className="text-orange-400 shrink-0" />
                    <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">本班签到链接</p>
                  </div>
                  {!signinEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={startEditSignin}
                        className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[11px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 smooth-transition"
                      >
                        <Pencil size={11} />
                        <span>{classSignin ? '修改' : '设置'}</span>
                      </button>
                      {classSignin && (
                        <button
                          type="button"
                          onClick={handleClearSignin}
                          disabled={signinBusy}
                          className="p-1.5 rounded-[var(--radius-sm)] text-zinc-500 hover:text-rose-500 hover:bg-rose-950/20 disabled:opacity-40 smooth-transition"
                          aria-label="清除本班签到链接"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {signinEditing ? (
                  <div className="space-y-2 pt-1">
                    <input
                      value={signinUrl}
                      onChange={e => setSigninUrl(e.target.value)}
                      placeholder="签到链接 https://…/checkin/…"
                      className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
                    />
                    <input
                      value={signinPasscode}
                      onChange={e => setSigninPasscode(e.target.value)}
                      placeholder="口令（如：012459）"
                      className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-600 font-mono tracking-widest focus:outline-none focus:border-orange-500"
                    />
                    {signinError && <p className="text-[10px] text-rose-400">{signinError}</p>}
                    <div className="flex gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={handleSaveSignin}
                        disabled={signinBusy || !signinUrl.trim()}
                        className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold disabled:opacity-40 smooth-transition"
                      >
                        {signinBusy ? '保存中…' : '保存'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSigninEditing(false)}
                        disabled={signinBusy}
                        className="px-3 py-1.5 rounded-[var(--radius-sm)] border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 disabled:opacity-40 smooth-transition"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : classSignin ? (
                  <p className="text-[10px] text-zinc-500 break-all">
                    {classSignin.url} · 口令{' '}
                    <span className="font-mono tracking-widest text-orange-300">
                      {classSignin.passcode || '未设置'}
                    </span>
                  </p>
                ) : (
                  <p className="text-[10px] text-zinc-500">
                    尚未设置，班级前台暂不显示签到二维码。班级也可自行在前台设置。
                  </p>
                )}
                {!signinEditing && classError && <p className="text-[10px] text-rose-400">{classError}</p>}
              </div>

              {/* 定课 script assignment. Unassigned = the built-in default script;
                  assigning a variant here doesn't disable the in-panel host edits —
                  those still work, they just layer on top of the assigned variant
                  instead of the default. */}
              <div className="p-4 rounded-[var(--radius-md)] border border-zinc-800 bg-zinc-950/40 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-orange-400 shrink-0" />
                  <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">定课版本</p>
                </div>
                <select
                  value={selectedClass?.dingkeVariantId ?? ''}
                  onChange={e => selectedClass && handleAssignDingkeVariant(selectedClass, e.target.value)}
                  disabled={classBusy}
                  className="w-full px-3 py-2 text-xs rounded-[var(--radius-sm)] bg-zinc-950 border border-zinc-800 text-zinc-100 focus:outline-none focus:border-orange-500 disabled:opacity-40"
                >
                  <option value="">默认脚本（{DEFAULT_DINGKE_SECTIONS.length} 个环节）</option>
                  {dingkeVariants.map(variant => (
                    <option key={variant.id} value={variant.id}>{variant.name}（{variant.sections.length} 个环节）</option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500">
                  在左侧「定课版本」中新建或编辑版本。班级仍可在手机版定课里对单个环节做临时调整。
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
