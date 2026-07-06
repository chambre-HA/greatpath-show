import { NextResponse } from 'next/server'
import {
  addDedicationGroup, addDedicationPerson, listDedicationGroups,
  removeDedicationGroup, removeDedicationPerson, setDedicationPersonPaused,
  updateDedicationGroupPurpose,
} from '@/lib/r2-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const classCode = searchParams.get('class')
  if (!classCode) return NextResponse.json({ error: 'missing class' }, { status: 400 })
  try {
    const items = await listDedicationGroups(classCode)
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

    if (body.action === 'addGroup' && body.group) {
      await addDedicationGroup(classCode, body.group)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'updateGroupPurpose' && typeof body.groupId === 'string' && typeof body.purpose === 'string') {
      await updateDedicationGroupPurpose(classCode, body.groupId, body.purpose)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'removeGroup' && typeof body.groupId === 'string') {
      await removeDedicationGroup(classCode, body.groupId)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'addPerson' && typeof body.groupId === 'string' && body.person) {
      await addDedicationPerson(classCode, body.groupId, body.person)
      return NextResponse.json({ ok: true })
    }
    if (body.action === 'removePerson' && typeof body.groupId === 'string' && typeof body.personId === 'string') {
      await removeDedicationPerson(classCode, body.groupId, body.personId)
      return NextResponse.json({ ok: true })
    }
    if (
      body.action === 'togglePause' && typeof body.groupId === 'string' &&
      typeof body.personId === 'string' && typeof body.paused === 'boolean'
    ) {
      await setDedicationPersonPaused(classCode, body.groupId, body.personId, body.paused)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  } catch (e) {
    console.error('R2 write failed', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
