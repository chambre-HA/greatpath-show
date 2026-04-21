import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { ClassInfo, ShowLink } from '@/types'

const CLASSES_KEY = '_classes.json'
const INDEX_KEY = 'links.json'
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
  }
}

async function getJson<T>(client: S3Client, key: string, fallback: T): Promise<T> {
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
    const text = await out.Body?.transformToString()
    if (!text) return fallback
    return JSON.parse(text) as T
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === 'NoSuchKey') return fallback
    if ((e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404) return fallback
    throw e
  }
}

async function putJson(client: S3Client, key: string, value: unknown): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: JSON.stringify(value, null, 2),
    ContentType: 'application/json',
  }))
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
  }
}

export async function deleteClass(code: string): Promise<void> {
  const client = getClient()
  const classes = await listClasses()
  await putJson(client, CLASSES_KEY, classes.filter(c => c.code !== code))
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
  const mergedFiles = files.map(file => mergeLink(file, indexed.get(file.id)))
  const fileIds = new Set(files.map(f => f.id))
  const extras = index.filter(l => !fileIds.has(l.id))
  return [...extras, ...mergedFiles].sort(sortLinks)
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

export async function reorderLinks(classCode: string, ids: string[]): Promise<void> {
  const client = getClient()
  const links = await listAllLinks(classCode)
  const byId = new Map(links.map(link => [link.id, link]))
  const orderedIds = ids.filter(id => byId.has(id))
  for (const link of links) {
    if (!orderedIds.includes(link.id)) orderedIds.push(link.id)
  }
  const next = orderedIds.map((id, index) => ({ ...byId.get(id)!, order: index + 1 }))
  await putJson(client, classIndexKey(classCode), next)
}

export async function removeLink(classCode: string, id: string): Promise<void> {
  const client = getClient()
  const items = await getStoredLinks(client, classCode)
  if (id.startsWith('r2:')) {
    const key = id.slice(3)
    await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
  }
  await putJson(client, classIndexKey(classCode), compactLinkOrder(items.filter(l => l.id !== id)))
}
