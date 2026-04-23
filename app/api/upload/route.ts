import { NextRequest, NextResponse } from 'next/server'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 50 * 1024 * 1024

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

function kindFromName(name: string): 'pdf' | 'ppt' | null {
  const l = name.toLowerCase()
  if (l.endsWith('.pdf')) return 'pdf'
  if (l.endsWith('.pptx') || l.endsWith('.ppt')) return 'ppt'
  return null
}

function titleFromName(name: string) {
  return name.replace(/\.(pdf|pptx?)$/i, '')
}

function mimeFromKind(kind: 'pdf' | 'ppt') {
  return kind === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const classCode = formData.get('classCode') as string | null

  if (!file || !classCode) {
    return NextResponse.json({ error: 'Missing file or classCode' }, { status: 400 })
  }
  if (!/^\d{8}$/.test(classCode)) {
    return NextResponse.json({ error: 'Invalid class code' }, { status: 400 })
  }

  const kind = kindFromName(file.name)
  if (!kind) {
    return NextResponse.json({ error: 'Only PDF and PPTX files are supported' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 })
  }

  const bucket = env('R2_BUCKET')
  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
  const client = getClient()
  const key = `${classCode}/${file.name}`

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

  if (!existed) {
    const bytes = await file.arrayBuffer()
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(bytes),
      ContentType: file.type || mimeFromKind(kind),
    }))
  }

  return NextResponse.json({
    existed,
    link: {
      id: `r2:${key}`,
      title: titleFromName(file.name),
      url: `${publicBase}/${encodeURI(key)}`,
      kind,
      r2Key: key,
      size: existed ? existingSize : file.size,
      addedAt: new Date().toISOString(),
    },
  })
}
