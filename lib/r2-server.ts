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

// ── Class management ───────────────────────────────────────────────────────

export async function listClasses(): Promise<ClassInfo[]> {
  const client = getClient()
  return getJson<ClassInfo[]>(client, CLASSES_KEY, [])
}

export async function addClass(info: ClassInfo): Promise<void> {
  const client = getClient()
  const classes = await getJson<ClassInfo[]>(client, CLASSES_KEY, [])
  if (!classes.some(c => c.code === info.code)) {
    classes.push(info)
    await putJson(client, CLASSES_KEY, classes)
  }
}

export async function deleteClass(code: string): Promise<void> {
  const client = getClient()
  const classes = await getJson<ClassInfo[]>(client, CLASSES_KEY, [])
  await putJson(client, CLASSES_KEY, classes.filter(c => c.code !== code))
}

// ── Link management ────────────────────────────────────────────────────────

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
    getJson<ShowLink[]>(client, classIndexKey(classCode), []),
  ])
  const fileIds = new Set(files.map(f => f.id))
  const extras = index.filter(l => !fileIds.has(l.id))
  return [...extras, ...files].sort((a, b) => b.addedAt.localeCompare(a.addedAt))
}

export async function addLink(classCode: string, link: ShowLink): Promise<void> {
  const client = getClient()
  const items = await getJson<ShowLink[]>(client, classIndexKey(classCode), [])
  if (!items.some(l => l.id === link.id)) items.unshift(link)
  await putJson(client, classIndexKey(classCode), items)
}

export async function removeLink(classCode: string, id: string): Promise<void> {
  const client = getClient()
  if (id.startsWith('r2:')) {
    const key = id.slice(3)
    await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
    return
  }
  const items = await getJson<ShowLink[]>(client, classIndexKey(classCode), [])
  await putJson(client, classIndexKey(classCode), items.filter(l => l.id !== id))
}
