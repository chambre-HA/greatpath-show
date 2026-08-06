import { NextResponse } from 'next/server'
import { clearClassSigninOverride, getClassSignin, listClasses, setClassSigninOverride } from '@/lib/r2-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The class's own greatpath check-in link, maintained from the class page
// itself — no admin password, same as the other per-class panels: knowing the
// 8-digit class code is what gates the page. Whatever a class saves here stays
// until someone in that class replaces or clears it.
async function requireClass(code: unknown): Promise<string> {
  if (typeof code !== 'string' || !code.trim()) throw new Error('missing class')
  const classes = await listClasses()
  if (!classes.some(c => c.code === code.trim())) throw new Error('班级不存在')
  return code.trim()
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const classCode = await requireClass(body.class)

    if (body.action === 'clear') {
      await clearClassSigninOverride(classCode)
    } else if (body.action === 'save') {
      await setClassSigninOverride(classCode, String(body.url ?? ''), String(body.passcode ?? ''))
    } else {
      return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }

    return NextResponse.json({ signin: await getClassSignin(classCode) })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    const bad = message === 'missing class' || message === '班级不存在' || message.startsWith('签到链接') || message.startsWith('口令')
    if (!bad) console.error('Class sign-in write failed', e)
    return NextResponse.json({ error: message }, { status: bad ? 400 : 500 })
  }
}
