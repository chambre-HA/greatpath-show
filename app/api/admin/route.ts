import { NextResponse } from 'next/server'
import { addClass, addLink, deleteClass, listAllLinks, listClasses, removeLink } from '@/lib/r2-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function auth(body: { password?: string }): boolean {
  return body.password === process.env.ADMIN_PASSWORD
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!auth(body)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    switch (body.action) {
      case 'listClasses':
        return NextResponse.json(await listClasses())
      case 'addClass':
        await addClass({ code: body.code, name: body.name, createdAt: new Date().toISOString() })
        return NextResponse.json({ ok: true })
      case 'deleteClass':
        await deleteClass(body.code)
        return NextResponse.json({ ok: true })
      case 'listLinks':
        return NextResponse.json(await listAllLinks(body.code))
      case 'addLink':
        await addLink(body.code, body.link)
        return NextResponse.json({ ok: true })
      case 'removeLink':
        await removeLink(body.code, body.id)
        return NextResponse.json({ ok: true })
      default:
        return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }
  } catch (e) {
    console.error('Admin error', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
