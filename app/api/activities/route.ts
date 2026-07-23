import { NextResponse } from 'next/server'
import { fetchOrgActivities } from '@/lib/activities'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const activities = await fetchOrgActivities()
    return NextResponse.json(activities)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
