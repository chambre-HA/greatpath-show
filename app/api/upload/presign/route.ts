import { NextRequest, NextResponse } from 'next/server'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 500 * 1024 * 1024

function env(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function getClient() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    },
  })
}

function kindFromName(name: string): 'pdf' | 'ppt' | 'video' | null {
  const l = name.toLowerCase()
  if (l.endsWith('.pdf')) return 'pdf'
  if (l.endsWith('.pptx') || l.endsWith('.ppt')) return 'ppt'
  if (l.endsWith('.mp4') || l.endsWith('.webm') || l.endsWith('.mov') || l.endsWith('.ogv')) return 'video'
  return null
}

function titleFromName(name: string) {
  return name.replace(/\.(pdf|pptx?|mp4|webm|mov|ogv)$/i, '')
}

function mimeFromKind(kind: 'pdf' | 'ppt' | 'video') {
  if (kind === 'pdf') return 'application/pdf'
  if (kind === 'video') return 'video/mp4'
  return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}

export async function POST(req: NextRequest) {
  let body: { classCode?: string; filename?: string; size?: number; contentType?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { classCode, filename, size } = body
  if (!classCode || !filename || typeof size !== 'number') {
    return NextResponse.json({ error: 'Missing classCode, filename, or size' }, { status: 400 })
  }
  if (!/^\d{8}$/.test(classCode)) {
    return NextResponse.json({ error: 'Invalid class code' }, { status: 400 })
  }

  const kind = kindFromName(filename)
  if (!kind) {
    return NextResponse.json({ error: 'Only PDF, PPTX, and video files (MP4, WebM) are supported' }, { status: 400 })
  }
  if (size > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 })
  }

  const bucket = env('R2_BUCKET')
  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
  const client = getClient()
  const key = `${classCode}/${filename}`
  const contentType = body.contentType || mimeFromKind(kind)

  let existed = false
  let existingSize: number | undefined
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    existed = true
    existingSize = head.ContentLength
  } catch (e: unknown) {
    const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
    const name = (e as { name?: string })?.name
    if (status !== 404 && name !== 'NotFound') throw e
  }

  const uploadUrl = existed
    ? null
    : await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
        { expiresIn: 600 },
      )

  return NextResponse.json({
    existed,
    uploadUrl,
    contentType,
    link: {
      id: `r2:${key}`,
      title: titleFromName(filename),
      url: `${publicBase}/${encodeURI(key)}`,
      kind,
      r2Key: key,
      size: existed ? existingSize : size,
      addedAt: new Date().toISOString(),
    },
  })
}
