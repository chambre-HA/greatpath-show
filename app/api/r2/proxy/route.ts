import { NextResponse } from 'next/server'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const key = url.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'missing key' }, { status: 400 })

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    },
  })

  try {
    const out = await client.send(
      new GetObjectCommand({ Bucket: env('R2_BUCKET'), Key: key })
    )
    const body = out.Body as ReadableStream | undefined
    if (!body) return NextResponse.json({ error: 'empty body' }, { status: 500 })

    return new NextResponse(body as ReadableStream, {
      headers: {
        'Content-Type': out.ContentType ?? 'application/octet-stream',
        'Content-Length': out.ContentLength?.toString() ?? '',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    console.error('R2 proxy failed', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 }
    )
  }
}
