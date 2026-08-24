import { NextResponse } from 'next/server'
import { clearDingkeOverride, getBaseDingkeSections, getDingkeOverrides, setDingkeOverride } from '@/lib/r2-server'
import { resolveSections } from '@/lib/dingke-resolve'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const classCode = searchParams.get('class')
  if (!classCode) return NextResponse.json({ error: 'missing class' }, { status: 400 })
  try {
    const [overrides, baseSections] = await Promise.all([
      getDingkeOverrides(classCode),
      getBaseDingkeSections(classCode),
    ])
    return NextResponse.json({
      sections: resolveSections(baseSections, overrides),
      overriddenIds: Object.keys(overrides),
    })
  } catch (e) {
    console.error('R2 read failed', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const classCode = body.class
    if (!classCode) return NextResponse.json({ error: 'missing class' }, { status: 400 })
    if (typeof body.sectionId !== 'string') {
      return NextResponse.json({ error: 'unknown section' }, { status: 400 })
    }

    // Clearing an override is always allowed, even for a section id that no
    // longer exists in the class's current base (e.g. its assigned variant
    // was deleted, or a section was removed from it) — that override is
    // already inert since resolveSections only reads keys it can match to a
    // base section, but it should still be possible to clean up the stray key.
    if (body.action === 'reset') {
      await clearDingkeOverride(classCode, body.sectionId)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'save') {
      const baseSections = await getBaseDingkeSections(classCode)
      const base = baseSections.find(s => s.id === body.sectionId)
      if (!base) return NextResponse.json({ error: 'unknown section' }, { status: 400 })
      await setDingkeOverride(classCode, body.sectionId, {
        title: typeof body.title === 'string' ? body.title : undefined,
        subtitle: typeof body.subtitle === 'string' ? body.subtitle : undefined,
        slideLines: Array.isArray(body.slideLines) ? body.slideLines.filter((l: unknown) => typeof l === 'string') : undefined,
        body: typeof body.body === 'string' ? body.body : undefined,
      }, base)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  } catch (e) {
    console.error('R2 write failed', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
