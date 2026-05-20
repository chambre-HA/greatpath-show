import { NextResponse } from 'next/server'
import { addMessage, listMessages, removeMessage, updateMessage } from '@/lib/r2-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const classCode = searchParams.get('class')
  if (!classCode) return NextResponse.json({ error: 'missing class' }, { status: 400 })
  try {
    return NextResponse.json(await listMessages(classCode))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const classCode = body.class
    if (!classCode) return NextResponse.json({ error: 'missing class' }, { status: 400 })

    if (body.action === 'add' && body.message) {
      await addMessage(classCode, body.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'update' && body.message) {
      await updateMessage(classCode, body.message)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'remove' && typeof body.id === 'string') {
      await removeMessage(classCode, body.id)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
