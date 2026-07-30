import { NextRequest, NextResponse } from 'next/server'
import { fetchClassSessionCheckins, type SessionType } from '@/lib/classCheckins'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { className, sessionDate, sessionType, sessionPeriod, groupNumber } = body as {
      className?: string
      sessionDate?: string
      sessionType?: SessionType
      sessionPeriod?: 'morning' | 'evening' | null
      groupNumber?: number | null
    }

    if (!className || !sessionDate || !sessionType) {
      return NextResponse.json({ error: '参数无效' }, { status: 400 })
    }

    const result = await fetchClassSessionCheckins({
      className,
      sessionDate,
      sessionType,
      sessionPeriod,
      groupNumber,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
