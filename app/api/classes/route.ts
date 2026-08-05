import { NextResponse } from 'next/server'
import { getClassSignin, listClasses } from '@/lib/r2-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  try {
    const classes = await listClasses()
    if (code) {
      const found = classes.find(c => c.code === code)
      // The sign-in link + passcode ride along with the single-class lookup:
      // knowing the 8-digit class code is already what gates the class page.
      const signin = found ? await getClassSignin(code) : null
      return NextResponse.json({ valid: Boolean(found), class: found ?? null, signin })
    }
    return NextResponse.json(classes)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
