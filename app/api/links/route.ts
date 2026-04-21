import { NextResponse } from 'next/server'
import { addLink, listAllLinks, removeLink, reorderLinks, updateLink } from '@/lib/r2-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const classCode = searchParams.get('class')
  if (!classCode) return NextResponse.json({ error: 'missing class' }, { status: 400 })
  try {
    const items = await listAllLinks(classCode)
    return NextResponse.json(items)
  } catch (e) {
    console.error('R2 list failed', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const classCode = body.class
    if (!classCode) return NextResponse.json({ error: 'missing class' }, { status: 400 })

    if (body.action === 'add' && body.link) {
      await addLink(classCode, body.link)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'remove' && typeof body.id === 'string') {
      await removeLink(classCode, body.id)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'update' && body.link) {
      await updateLink(classCode, body.link)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'reorder' && Array.isArray(body.ids)) {
      await reorderLinks(classCode, body.ids)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  } catch (e) {
    console.error('R2 write failed', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
