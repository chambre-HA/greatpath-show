import { NextResponse } from 'next/server'
import { listClasses } from '@/lib/r2-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  try {
    const classes = await listClasses()
    if (code) {
      return NextResponse.json({ valid: classes.some(c => c.code === code) })
    }
    return NextResponse.json(classes)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
