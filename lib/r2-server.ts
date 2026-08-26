import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { ClassInfo, ClassSignin, ClassSigninOverride, DedicationGroup, DedicationPerson, DingkeOverrides, DingkeSection, DingkeSectionOverride, DingkeVariant, MessageTemplate, ResourceLink, ShowLink } from '@/types'
import { DEFAULT_DINGKE_SECTIONS } from './dingke-content'
import { blocksToBody } from './dingke-resolve'

const CLASSES_KEY = '_classes.json'
const RESOURCES_KEY = '_resources.json'
const DINGKE_VARIANTS_KEY = '_dingke-variants.json'
const SIGNIN_KEY = 'signin.json'
const INDEX_KEY = 'links.json'
const MESSAGES_KEY = 'messages.json'
const DEDICATION_KEY = 'dedication.json'
const DINGKE_KEY = 'dingke.json'
const CLASS_CODE_LENGTH = 8

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function getClient(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    },
  })
}

const bucket = () => env('R2_BUCKET')
const publicBase = () => (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

function classIndexKey(classCode: string) {
  return `${classCode}/${INDEX_KEY}`
}

function kindFromKey(key: string): ShowLink['kind'] | null {
  const k = key.toLowerCase()
  if (k.endsWith('.pdf')) return 'pdf'
  if (k.endsWith('.pptx') || k.endsWith('.ppt')) return 'ppt'
  return null
}

function titleFromKey(key: string): string {
  const name = key.split('/').pop() ?? key
  return name.replace(/\.(pdf|pptx?|PDF|PPTX?|Ppt|Pptx)$/, '')
}

function sortLinks(a: ShowLink, b: ShowLink): number {
  const orderA = a.order ?? Number.MAX_SAFE_INTEGER
  const orderB = b.order ?? Number.MAX_SAFE_INTEGER
  if (orderA !== orderB) return orderA - orderB
  return b.addedAt.localeCompare(a.addedAt)
}

function normalizeStoredLinks(links: ShowLink[]): ShowLink[] {
  return links.map(link => ({ ...link }))
}

function compactLinkOrder(links: ShowLink[]): ShowLink[] {
  return [...links]
    .sort(sortLinks)
    .map((link, index) => ({ ...link, order: index + 1 }))
}

function mergeLink(base: ShowLink, stored?: ShowLink): ShowLink {
  if (!stored) return base
  return {
    ...base,
    title: stored.title || base.title,
    url: stored.url || base.url,
    order: stored.order,
    tags: stored.tags,
    hidden: stored.hidden,
  }
}

// R2 occasionally answers a perfectly valid request with a 5xx InternalError
// ("We encountered an internal error. Please try again."). A single blip on a
// metadata write would surface to the admin as a failed action, so retry the
// small JSON reads/writes a couple of times before giving up.
function isTransientR2Error(e: unknown): boolean {
  const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
  const name = (e as { name?: string })?.name
  return (status !== undefined && status >= 500) || name === 'InternalError' || name === 'SlowDown'
}

async function withRetry<T>(op: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await op()
    } catch (e) {
      lastError = e
      if (!isTransientR2Error(e)) throw e
      await new Promise(resolve => setTimeout(resolve, 150 * 2 ** i))
    }
  }
  throw lastError
}

async function getJson<T>(client: S3Client, key: string, fallback: T): Promise<T> {
  try {
    return await withRetry(async () => {
      const out = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
      const text = await out.Body?.transformToString()
      if (!text) return fallback
      return JSON.parse(text) as T
    })
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === 'NoSuchKey') return fallback
    if ((e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404) return fallback
    throw e
  }
}

async function putJson(client: S3Client, key: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value, null, 2)
  await withRetry(() => client.send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: body,
    ContentType: 'application/json',
  })))
}

function normalizeClassCode(code: string): string {
  return code.trim()
}

function normalizeClassName(name: string | undefined, code: string): string {
  const trimmed = name?.trim()
  return trimmed || code
}

function normalizeClassInfo(info: Pick<ClassInfo, 'code'> & Partial<ClassInfo>): ClassInfo {
  const code = normalizeClassCode(info.code)
  return {
    code,
    name: normalizeClassName(info.name, code),
    createdAt: info.createdAt ?? new Date().toISOString(),
    dingkeVariantId: info.dingkeVariantId?.trim() || undefined,
  }
}

function validateClassCode(code: string): void {
  if (!/^\d{8}$/.test(code)) {
    throw new Error(`Class code must be exactly ${CLASS_CODE_LENGTH} digits`)
  }
}

// ── Class management ───────────────────────────────────────────────────────

export async function listClasses(): Promise<ClassInfo[]> {
  const client = getClient()
  const classes = await getJson<Array<Pick<ClassInfo, 'code'> & Partial<ClassInfo>>>(client, CLASSES_KEY, [])
  return classes.map(normalizeClassInfo)
}

export async function addClass(info: ClassInfo): Promise<void> {
  const client = getClient()
  const next = normalizeClassInfo(info)
  validateClassCode(next.code)

  const classes = await listClasses()
  if (!classes.some(c => c.code === next.code)) {
    classes.push(next)
    await putJson(client, CLASSES_KEY, classes)
    await seedDefaultDedicationGroups(next.code)
  }
}

export async function updateClass(info: ClassInfo): Promise<void> {
  const client = getClient()
  const next = normalizeClassInfo(info)
  validateClassCode(next.code)

  const classes = await listClasses()
  const index = classes.findIndex(c => c.code === next.code)
  if (index < 0) {
    throw new Error('Class not found')
  }
  classes[index] = {
    ...classes[index],
    name: next.name,
    // `dingkeVariantId: undefined` on the way in means "unassign", so this
    // is a straight overwrite rather than a merge.
    dingkeVariantId: next.dingkeVariantId,
  }
  await putJson(client, CLASSES_KEY, classes)
}

export async function deleteClass(code: string): Promise<void> {
  const client = getClient()
  const classes = await listClasses()
  await putJson(client, CLASSES_KEY, classes.filter(c => c.code !== code))
}

// ── 定课 script variants ────────────────────────────────────────────────────
// A variant is a full independent section list (not a patch on top of the
// default script), for classes whose flow genuinely differs — different
// sections, counts, or order — rather than just different wording on the same
// ten. Classes point at one via ClassInfo.dingkeVariantId; a class's own
// DingkeOverrides still layer on top of whichever base (variant or default)
// it resolves to.

function normalizeDingkeVariant(
  variant: Partial<DingkeVariant> & Pick<DingkeVariant, 'name' | 'sections'>,
): DingkeVariant {
  return {
    id: variant.id?.trim() || crypto.randomUUID(),
    name: variant.name.trim(),
    sections: variant.sections,
    updatedAt: new Date().toISOString(),
  }
}

export async function listDingkeVariants(): Promise<DingkeVariant[]> {
  const client = getClient()
  const variants = await getJson<DingkeVariant[]>(client, DINGKE_VARIANTS_KEY, [])
  return variants.filter(v => v && v.id).sort((a, b) => a.name.localeCompare(b.name, 'zh'))
}

/** Creates the variant when `id` is absent or unknown, otherwise overwrites it. */
export async function saveDingkeVariant(
  variant: Partial<DingkeVariant> & Pick<DingkeVariant, 'name' | 'sections'>,
): Promise<DingkeVariant> {
  const next = normalizeDingkeVariant(variant)
  if (!next.name) throw new Error('版本名称不能为空')
  if (!next.sections?.length) throw new Error('至少需要一个环节')
  if (next.sections.some(s => !s.id?.trim())) throw new Error('每个环节都需要 id')
  const ids = next.sections.map(s => s.id)
  if (new Set(ids).size !== ids.length) throw new Error('环节 id 不能重复')

  const client = getClient()
  const variants = await listDingkeVariants()
  const index = variants.findIndex(v => v.id === next.id)
  if (index < 0) variants.push(next)
  else variants[index] = next
  await putJson(client, DINGKE_VARIANTS_KEY, variants)
  return next
}

/** Also unassigns the variant from any class pointing at it (falls back to the default script). */
export async function deleteDingkeVariant(id: string): Promise<void> {
  const client = getClient()
  const variants = await listDingkeVariants()
  await putJson(client, DINGKE_VARIANTS_KEY, variants.filter(v => v.id !== id))

  const classes = await listClasses()
  if (classes.some(c => c.dingkeVariantId === id)) {
    await putJson(
      client,
      CLASSES_KEY,
      classes.map(c => (c.dingkeVariantId === id ? { ...c, dingkeVariantId: undefined } : c)),
    )
  }
}

/** What a class actually runs before its own per-section overrides are applied. */
export async function getBaseDingkeSections(classCode: string): Promise<DingkeSection[]> {
  const classes = await listClasses()
  const cls = classes.find(c => c.code === classCode)
  if (cls?.dingkeVariantId) {
    const variants = await listDingkeVariants()
    const variant = variants.find(v => v.id === cls.dingkeVariantId)
    if (variant) return variant.sections
  }
  return DEFAULT_DINGKE_SECTIONS
}

// ── Per-class sign-in link ─────────────────────────────────────────────────
// Every class has its own greatpath check-in link and 口令 — there is no
// shared/学堂-wide fallback. Editable from the class's own page without the
// admin password (the 8-digit class code is already what gates that page) or
// from the admin panel; it lives in the class's own object so it can't race
// admin writes to _classes.json.

function signinKey(classCode: string) {
  return `${classCode}/${SIGNIN_KEY}`
}

export async function getClassSigninOverride(classCode: string): Promise<ClassSigninOverride | null> {
  const client = getClient()
  const stored = await getJson<ClassSigninOverride | null>(client, signinKey(normalizeClassCode(classCode)), null)
  return stored?.url ? stored : null
}

export async function setClassSigninOverride(
  classCode: string,
  url: string,
  passcode: string,
): Promise<ClassSigninOverride> {
  const trimmedUrl = url.trim()
  const trimmedPasscode = passcode.trim()
  if (!/^https?:\/\//i.test(trimmedUrl)) throw new Error('签到链接必须以 http(s):// 开头')
  if (trimmedUrl.length > 500) throw new Error('签到链接过长')
  if (trimmedPasscode.length > 32) throw new Error('口令过长')

  const next: ClassSigninOverride = {
    url: trimmedUrl,
    passcode: trimmedPasscode,
    updatedAt: new Date().toISOString(),
  }
  await putJson(getClient(), signinKey(normalizeClassCode(classCode)), next)
  return next
}

export async function clearClassSigninOverride(classCode: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({
    Bucket: bucket(),
    Key: signinKey(normalizeClassCode(classCode)),
  }))
}

/** The class's own sign-in link. Null when the class hasn't set one (or is unknown). */
export async function getClassSignin(classCode: string): Promise<ClassSignin | null> {
  const code = normalizeClassCode(classCode)
  const [classes, own] = await Promise.all([listClasses(), getClassSigninOverride(code)])
  if (!own) return null
  const cls = classes.find(c => c.code === code)
  return {
    label: cls?.name || code,
    url: own.url,
    passcode: own.passcode,
    updatedAt: own.updatedAt,
  }
}

// ── Link management ────────────────────────────────────────────────────────

async function getStoredLinks(client: S3Client, classCode: string): Promise<ShowLink[]> {
  const items = await getJson<ShowLink[]>(client, classIndexKey(classCode), [])
  return normalizeStoredLinks(items)
}

async function listBucketFiles(client: S3Client, classCode: string): Promise<ShowLink[]> {
  const out = await client.send(new ListObjectsV2Command({
    Bucket: bucket(),
    Prefix: `${classCode}/`,
    MaxKeys: 1000,
  }))
  const base = publicBase()
  const idxKey = classIndexKey(classCode)
  return (out.Contents ?? [])
    .filter(o => o.Key && o.Key !== idxKey)
    .map(o => {
      const key = o.Key!
      const kind = kindFromKey(key)
      if (!kind) return null
      const link: ShowLink = {
        id: `r2:${key}`,
        title: titleFromKey(key),
        url: `${base}/${encodeURI(key)}`,
        kind,
        addedAt: o.LastModified?.toISOString() ?? new Date().toISOString(),
        r2Key: key,
      }
      if (o.Size != null) link.size = o.Size
      return link
    })
    .filter((x): x is ShowLink => x !== null)
}

export async function listAllLinks(classCode: string): Promise<ShowLink[]> {
  const client = getClient()
  const [files, index] = await Promise.all([
    listBucketFiles(client, classCode),
    getStoredLinks(client, classCode),
  ])
  const indexed = new Map(index.map(link => [link.id, link]))
  const hiddenIds = new Set(index.filter(l => l.hidden).map(l => l.id))
  const mergedFiles = files
    .filter(file => !hiddenIds.has(file.id))
    .map(file => mergeLink(file, indexed.get(file.id)))
  const fileIds = new Set(files.map(f => f.id))
  const extras = index.filter(l => !fileIds.has(l.id) && !l.hidden)
  return [...extras, ...mergedFiles].sort(sortLinks)
}

export async function listHiddenLinks(classCode: string): Promise<ShowLink[]> {
  const client = getClient()
  const [files, index] = await Promise.all([
    listBucketFiles(client, classCode),
    getStoredLinks(client, classCode),
  ])
  const indexed = new Map(index.map(link => [link.id, link]))
  const hidden = index.filter(l => l.hidden)
  return hidden.map(entry => {
    if (entry.id.startsWith('r2:')) {
      const file = files.find(f => f.id === entry.id)
      if (file) return mergeLink(file, indexed.get(file.id))
    }
    return entry
  })
}

/**
 * Same merge as listAllLinks, but keeps hidden entries (with their `hidden`
 * flag) instead of filtering them out — for the admin's global 共享库 view,
 * which is meant to stay a complete inventory of every file any class has
 * ever added, including ones a class has since hidden from its own picker.
 * Hiding a file is a per-class visibility toggle, not a deletion, so it
 * should not make the file disappear from cross-class admin housekeeping.
 */
async function listAllLinksIncludingHidden(classCode: string): Promise<ShowLink[]> {
  const client = getClient()
  const [files, index] = await Promise.all([
    listBucketFiles(client, classCode),
    getStoredLinks(client, classCode),
  ])
  const indexed = new Map(index.map(link => [link.id, link]))
  const mergedFiles = files.map(file => mergeLink(file, indexed.get(file.id)))
  const fileIds = new Set(files.map(f => f.id))
  const extras = index.filter(l => !fileIds.has(l.id))
  return [...extras, ...mergedFiles].sort(sortLinks)
}

export async function listGlobalLibrary(forClassCode: string): Promise<ShowLink[]> {
  const client = getClient()
  const [classes, activeLinks] = await Promise.all([
    listClasses(),
    listAllLinks(forClassCode),
  ])
  const activeUrls = new Set(activeLinks.map(l => l.url))
  const seenUrls = new Set<string>(activeUrls)
  const libraryLinks: ShowLink[] = []

  for (const cls of classes) {
    if (cls.code === forClassCode) continue
    const items = await getJson<ShowLink[]>(client, classIndexKey(cls.code), [])
    for (const link of items) {
      if (link.hidden || seenUrls.has(link.url)) continue
      seenUrls.add(link.url)
      libraryLinks.push({ ...link, hidden: undefined, order: undefined })
    }
  }
  return libraryLinks.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
}

export interface LibraryOwner {
  code: string
  name: string
  id: string
  /** Whether this owning class currently has the file hidden from its own picker. */
  hidden?: boolean
}

export async function listAllLibraryLinks(): Promise<(ShowLink & { owners: LibraryOwner[] })[]> {
  const classes = await listClasses()
  const perClass = await Promise.all(
    classes.map(async cls => {
      const links = await listAllLinksIncludingHidden(cls.code)
      return links.map(link => ({ link, ownerCode: cls.code, ownerName: cls.name }))
    })
  )

  const groups = new Map<string, { link: ShowLink; owners: LibraryOwner[] }>()
  for (const { link, ownerCode, ownerName } of perClass.flat()) {
    const key = link.url
    const owner: LibraryOwner = { code: ownerCode, name: ownerName, id: link.id, hidden: link.hidden || undefined }
    const existing = groups.get(key)
    if (existing) {
      // Prefer an owner's active copy as the representative link (title/kind/etc.)
      // when the same url is both active in one class and hidden in another.
      if (existing.link.hidden && !link.hidden) existing.link = link
      existing.owners.push(owner)
    } else {
      groups.set(key, { link, owners: [owner] })
    }
  }

  return [...groups.values()]
    .map(({ link, owners }) => ({ ...link, owners }))
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
}

export async function addLink(classCode: string, link: ShowLink): Promise<void> {
  const client = getClient()
  const items = await getStoredLinks(client, classCode)
  if (items.some(l => l.id === link.id)) return
  items.push({
    ...link,
    order: compactLinkOrder([...items, { ...link }]).length,
  })
  await putJson(client, classIndexKey(classCode), compactLinkOrder(items))
}

export async function updateLink(classCode: string, link: ShowLink): Promise<void> {
  const client = getClient()
  const items = await getStoredLinks(client, classCode)
  const index = items.findIndex(item => item.id === link.id)
  if (index >= 0) {
    items[index] = { ...items[index], ...link }
  } else {
    items.push({ ...link, order: link.order ?? items.length + 1 })
  }
  await putJson(client, classIndexKey(classCode), compactLinkOrder(items))
}

/**
 * Patches `order` onto the stored index for exactly the ids given, leaving
 * every other stored entry — crucially, hidden ones — untouched. `ids` is
 * ordinarily the class's whole current active list, but this must not
 * rebuild the index from listAllLinks(): that view already excludes hidden
 * links, so writing it back wholesale would silently erase every hidden
 * entry's `hidden` flag (or drop it outright) on the next reorder.
 */
export async function reorderLinks(classCode: string, ids: string[]): Promise<void> {
  const client = getClient()
  const [stored, files] = await Promise.all([
    getStoredLinks(client, classCode),
    listBucketFiles(client, classCode),
  ])
  const filesById = new Map(files.map(f => [f.id, f]))

  const next = [...stored]
  ids.forEach((id, index) => {
    const order = index + 1
    const existingIndex = next.findIndex(l => l.id === id)
    if (existingIndex >= 0) {
      next[existingIndex] = { ...next[existingIndex], order }
    } else {
      // A bare r2 bucket file with no stored metadata yet — add a minimal
      // entry just to carry its new order.
      const file = filesById.get(id)
      if (file) next.push({ ...file, order })
    }
  })

  await putJson(client, classIndexKey(classCode), next)
}

export async function removeLink(classCode: string, id: string): Promise<void> {
  const client = getClient()
  const items = await getStoredLinks(client, classCode)
  const existing = items.find(l => l.id === id)
  if (existing) {
    existing.hidden = true
    await putJson(client, classIndexKey(classCode), items)
  } else if (id.startsWith('r2:')) {
    const files = await listBucketFiles(client, classCode)
    const file = files.find(f => f.id === id)
    if (file) {
      items.push({ ...file, hidden: true })
      await putJson(client, classIndexKey(classCode), items)
    }
  }
}

export async function restoreLink(classCode: string, id: string): Promise<void> {
  const client = getClient()
  const items = await getStoredLinks(client, classCode)
  const idx = items.findIndex(l => l.id === id)
  if (idx >= 0) {
    items[idx] = { ...items[idx], hidden: false }
    await putJson(client, classIndexKey(classCode), items)
  }
}

export async function purgeLink(classCode: string, id: string): Promise<void> {
  const client = getClient()
  const items = await getStoredLinks(client, classCode)
  if (id.startsWith('r2:')) {
    const key = id.slice(3)
    await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
  }
  await putJson(client, classIndexKey(classCode), compactLinkOrder(items.filter(l => l.id !== id)))
}

// ── Message templates ──────────────────────────────────────────────────────

function messagesKey(classCode: string) {
  return `${classCode}/${MESSAGES_KEY}`
}

export async function listMessages(classCode: string): Promise<MessageTemplate[]> {
  const client = getClient()
  const items = await getJson<MessageTemplate[]>(client, messagesKey(classCode), [])
  return items.sort((a, b) => {
    const oa = a.order ?? Number.MAX_SAFE_INTEGER
    const ob = b.order ?? Number.MAX_SAFE_INTEGER
    return oa !== ob ? oa - ob : b.addedAt.localeCompare(a.addedAt)
  })
}

export async function addMessage(classCode: string, msg: MessageTemplate): Promise<void> {
  const client = getClient()
  const items = await getJson<MessageTemplate[]>(client, messagesKey(classCode), [])
  if (items.some(m => m.id === msg.id)) return
  items.push({ ...msg, order: items.length + 1 })
  await putJson(client, messagesKey(classCode), items)
}

export async function updateMessage(classCode: string, msg: MessageTemplate): Promise<void> {
  const client = getClient()
  const items = await getJson<MessageTemplate[]>(client, messagesKey(classCode), [])
  const idx = items.findIndex(m => m.id === msg.id)
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...msg }
  } else {
    items.push({ ...msg, order: items.length + 1 })
  }
  await putJson(client, messagesKey(classCode), items)
}

export async function removeMessage(classCode: string, id: string): Promise<void> {
  const client = getClient()
  const items = await getJson<MessageTemplate[]>(client, messagesKey(classCode), [])
  await putJson(client, messagesKey(classCode), items.filter(m => m.id !== id).map((m, i) => ({ ...m, order: i + 1 })))
}

// ── Dedication (回向) list ──────────────────────────────────────────────────
// Each group is one shared purpose/wish (e.g. "早日康复，病障远离") covering a set
// of people; people can be individually paused for the upcoming week.

const DEFAULT_DEDICATION_PURPOSES = [
  '早日康复，病障远离',
  '消灾解难，逢凶化吉',
  '学业进步，考试顺利',
]

function dedicationKey(classCode: string) {
  return `${classCode}/${DEDICATION_KEY}`
}

export async function seedDefaultDedicationGroups(classCode: string): Promise<void> {
  const client = getClient()
  const groups: DedicationGroup[] = DEFAULT_DEDICATION_PURPOSES.map((purpose, index) => ({
    id: crypto.randomUUID(),
    purpose,
    people: [],
    addedAt: new Date().toISOString(),
    order: index + 1,
  }))
  await putJson(client, dedicationKey(classCode), groups)
}

function sortDedicationGroups(groups: DedicationGroup[]): DedicationGroup[] {
  return [...groups].sort((a, b) => {
    const oa = a.order ?? Number.MAX_SAFE_INTEGER
    const ob = b.order ?? Number.MAX_SAFE_INTEGER
    return oa !== ob ? oa - ob : a.addedAt.localeCompare(b.addedAt)
  })
}

async function getDedicationGroups(client: S3Client, classCode: string): Promise<DedicationGroup[]> {
  return getJson<DedicationGroup[]>(client, dedicationKey(classCode), [])
}

export async function listDedicationGroups(classCode: string): Promise<DedicationGroup[]> {
  const client = getClient()
  return sortDedicationGroups(await getDedicationGroups(client, classCode))
}

export async function addDedicationGroup(classCode: string, group: DedicationGroup): Promise<void> {
  const client = getClient()
  const items = await getDedicationGroups(client, classCode)
  if (items.some(g => g.id === group.id)) return
  items.push({ ...group, order: items.length + 1 })
  await putJson(client, dedicationKey(classCode), items)
}

export async function updateDedicationGroupPurpose(classCode: string, groupId: string, purpose: string): Promise<void> {
  const client = getClient()
  const items = await getDedicationGroups(client, classCode)
  const idx = items.findIndex(g => g.id === groupId)
  if (idx >= 0) {
    items[idx] = { ...items[idx], purpose, updatedAt: new Date().toISOString() }
    await putJson(client, dedicationKey(classCode), items)
  }
}

export async function removeDedicationGroup(classCode: string, groupId: string): Promise<void> {
  const client = getClient()
  const items = await getDedicationGroups(client, classCode)
  await putJson(client, dedicationKey(classCode), items.filter(g => g.id !== groupId))
}

export async function addDedicationPerson(classCode: string, groupId: string, person: DedicationPerson): Promise<void> {
  const client = getClient()
  const items = await getDedicationGroups(client, classCode)
  const idx = items.findIndex(g => g.id === groupId)
  if (idx < 0) return
  if (items[idx].people.some(p => p.id === person.id)) return
  items[idx] = { ...items[idx], people: [...items[idx].people, person] }
  await putJson(client, dedicationKey(classCode), items)
}

export async function removeDedicationPerson(classCode: string, groupId: string, personId: string): Promise<void> {
  const client = getClient()
  const items = await getDedicationGroups(client, classCode)
  const idx = items.findIndex(g => g.id === groupId)
  if (idx < 0) return
  items[idx] = { ...items[idx], people: items[idx].people.filter(p => p.id !== personId) }
  await putJson(client, dedicationKey(classCode), items)
}

export async function setDedicationPersonPaused(classCode: string, groupId: string, personId: string, paused: boolean): Promise<void> {
  const client = getClient()
  const items = await getDedicationGroups(client, classCode)
  const idx = items.findIndex(g => g.id === groupId)
  if (idx < 0) return
  const people = items[idx].people.map(p => p.id === personId ? { ...p, paused, updatedAt: new Date().toISOString() } : p)
  items[idx] = { ...items[idx], people }
  await putJson(client, dedicationKey(classCode), items)
}

// ── 定课 script overrides ───────────────────────────────────────────────────
// Only the fields a class actually edited are stored; everything else keeps
// falling through to whatever the class's base script is (its assigned
// variant, or DEFAULT_DINGKE_SECTIONS), so central/variant script updates
// still reach classes that tweaked one section.

function dingkeKey(classCode: string) {
  return `${classCode}/${DINGKE_KEY}`
}

export async function getDingkeOverrides(classCode: string): Promise<DingkeOverrides> {
  const client = getClient()
  return getJson<DingkeOverrides>(client, dingkeKey(classCode), {})
}

/** `base` is the section from whatever the class's base script resolves to (see getBaseDingkeSections). */
export async function setDingkeOverride(
  classCode: string,
  sectionId: string,
  patch: Omit<DingkeSectionOverride, 'updatedAt'>,
  base: DingkeSection | undefined,
): Promise<void> {
  const client = getClient()
  const all = await getJson<DingkeOverrides>(client, dingkeKey(classCode), {})

  // Two things are filtered out here. An empty string means "clear this field
  // back to the default" rather than "override with blank" — a blank title
  // would just render as a hole. And a value identical to the default is not
  // stored at all: the editor prefills from the resolved section, so saving an
  // untouched field would otherwise freeze it against future script updates.
  const cleaned: DingkeSectionOverride = { updatedAt: new Date().toISOString() }
  const keep = (value: string | undefined, fallback: string | undefined) => {
    const trimmed = value?.trim()
    return trimmed && trimmed !== fallback?.trim() ? trimmed : undefined
  }
  const title = keep(patch.title, base?.title)
  if (title) cleaned.title = title
  const subtitle = keep(patch.subtitle, base?.subtitle)
  if (subtitle) cleaned.subtitle = subtitle
  const lines = patch.slideLines?.map(l => l.trim()).filter(Boolean)
  if (lines?.length && lines.join('\n') !== base?.slide.lines.join('\n')) cleaned.slideLines = lines
  const body = keep(patch.body, base ? blocksToBody(base.blocks) : undefined)
  if (body) cleaned.body = body

  const hasEdits = Object.keys(cleaned).length > 1
  if (hasEdits) all[sectionId] = cleaned
  else delete all[sectionId]
  await putJson(client, dingkeKey(classCode), all)
}

export async function clearDingkeOverride(classCode: string, sectionId: string): Promise<void> {
  const client = getClient()
  const all = await getJson<DingkeOverrides>(client, dingkeKey(classCode), {})
  delete all[sectionId]
  await putJson(client, dingkeKey(classCode), all)
}

// ── 常用资源 (useful resources) ─────────────────────────────────────────────
// One global list, curated by the admin, shared by every class — not stored
// per class like ShowLink. Grouped by category client-side for display.

function sortResources(items: ResourceLink[]): ResourceLink[] {
  return [...items].sort((a, b) => {
    const oa = a.order ?? Number.MAX_SAFE_INTEGER
    const ob = b.order ?? Number.MAX_SAFE_INTEGER
    return oa !== ob ? oa - ob : a.addedAt.localeCompare(b.addedAt)
  })
}

function compactResourceOrder(items: ResourceLink[]): ResourceLink[] {
  return sortResources(items).map((item, index) => ({ ...item, order: index + 1 }))
}

function normalizeResourceInput(input: { category?: string; name?: string; url?: string }) {
  const category = input.category?.trim()
  const name = input.name?.trim()
  const url = input.url?.trim()
  if (!category) throw new Error('分类不能为空')
  if (!name) throw new Error('名称不能为空')
  if (!url) throw new Error('链接不能为空')
  if (!/^https?:\/\//i.test(url)) throw new Error('链接必须以 http(s):// 开头')
  return { category, name, url }
}

export async function listResources(): Promise<ResourceLink[]> {
  const client = getClient()
  const items = await getJson<ResourceLink[]>(client, RESOURCES_KEY, [])
  return sortResources(items)
}

export async function addResource(input: { category: string; name: string; url: string }): Promise<ResourceLink> {
  const clean = normalizeResourceInput(input)
  const client = getClient()
  const items = await getJson<ResourceLink[]>(client, RESOURCES_KEY, [])
  const next: ResourceLink = {
    id: crypto.randomUUID(),
    ...clean,
    addedAt: new Date().toISOString(),
    order: items.length + 1,
  }
  await putJson(client, RESOURCES_KEY, [...items, next])
  return next
}

export async function updateResource(
  input: { id: string; category: string; name: string; url: string },
): Promise<void> {
  const clean = normalizeResourceInput(input)
  const client = getClient()
  const items = await getJson<ResourceLink[]>(client, RESOURCES_KEY, [])
  const idx = items.findIndex(r => r.id === input.id)
  if (idx < 0) throw new Error('资源不存在')
  items[idx] = { ...items[idx], ...clean }
  await putJson(client, RESOURCES_KEY, items)
}

export async function removeResource(id: string): Promise<void> {
  const client = getClient()
  const items = await getJson<ResourceLink[]>(client, RESOURCES_KEY, [])
  await putJson(client, RESOURCES_KEY, compactResourceOrder(items.filter(r => r.id !== id)))
}

export async function reorderResources(ids: string[]): Promise<void> {
  const client = getClient()
  const items = await getJson<ResourceLink[]>(client, RESOURCES_KEY, [])
  const byId = new Map(items.map(r => [r.id, r]))
  const next = ids.map(id => byId.get(id)).filter((r): r is ResourceLink => Boolean(r))
    .map((r, index) => ({ ...r, order: index + 1 }))
  // Any stored item not present in `ids` (shouldn't normally happen) keeps its
  // place at the end rather than silently vanishing.
  const missing = items.filter(r => !ids.includes(r.id))
  await putJson(client, RESOURCES_KEY, [...next, ...compactResourceOrder(missing).map(r => ({ ...r, order: next.length + r.order! }))])
}
