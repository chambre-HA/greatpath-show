import { NextResponse } from 'next/server'
import { listResources } from '@/lib/r2-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Global list — no per-class scoping, every class sees the same 常用资源.
export async function GET() {
  try {
    const items = await listResources()
    return NextResponse.json(items)
  } catch (e) {
    console.error('R2 list failed', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
