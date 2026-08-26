import { NextResponse } from 'next/server'
import { addClass, addLink, addResource, clearClassSigninOverride, deleteClass, deleteDingkeVariant, getClassSignin, listAllLibraryLinks, listAllLinks, listClasses, listDingkeVariants, listGlobalLibrary, listHiddenLinks, listResources, purgeLink, removeLink, removeResource, reorderLinks, reorderResources, restoreLink, saveDingkeVariant, setClassSigninOverride, updateClass, updateLink, updateResource } from '@/lib/r2-server'

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
      case 'updateClass':
        await updateClass({
          code: body.code,
          name: body.name,
          createdAt: body.createdAt ?? new Date().toISOString(),
          dingkeVariantId: body.dingkeVariantId ?? undefined,
        })
        return NextResponse.json({ ok: true })
      case 'listDingkeVariants':
        return NextResponse.json(await listDingkeVariants())
      case 'saveDingkeVariant':
        return NextResponse.json(await saveDingkeVariant({
          id: body.id,
          name: body.name,
          sections: body.sections,
        }))
      case 'deleteDingkeVariant':
        await deleteDingkeVariant(body.id)
        return NextResponse.json({ ok: true })
      case 'getClassSignin':
        return NextResponse.json(await getClassSignin(body.code))
      case 'saveClassSignin':
        await setClassSigninOverride(body.code, body.url, body.passcode)
        return NextResponse.json(await getClassSignin(body.code))
      case 'clearClassSignin':
        await clearClassSigninOverride(body.code)
        return NextResponse.json({ ok: true })
      case 'listLinks':
        return NextResponse.json(await listAllLinks(body.code))
      case 'addLink':
        await addLink(body.code, body.link)
        return NextResponse.json({ ok: true })
      case 'removeLink':
        await removeLink(body.code, body.id)
        return NextResponse.json({ ok: true })
      case 'updateLink':
        await updateLink(body.code, body.link)
        return NextResponse.json({ ok: true })
      case 'reorderLinks':
        await reorderLinks(body.code, body.ids)
        return NextResponse.json({ ok: true })
      case 'listHiddenLinks':
        return NextResponse.json(await listHiddenLinks(body.code))
      case 'restoreLink':
        await restoreLink(body.code, body.id)
        return NextResponse.json({ ok: true })
      case 'purgeLink':
        await purgeLink(body.code, body.id)
        return NextResponse.json({ ok: true })
      case 'listLibrary':
        return NextResponse.json(await listGlobalLibrary(body.code))
      case 'listLibraryAll':
        return NextResponse.json(await listAllLibraryLinks())
      case 'listResources':
        return NextResponse.json(await listResources())
      case 'addResource':
        return NextResponse.json(await addResource({ category: body.category, name: body.name, url: body.url }))
      case 'updateResource':
        await updateResource({ id: body.id, category: body.category, name: body.name, url: body.url })
        return NextResponse.json({ ok: true })
      case 'removeResource':
        await removeResource(body.id)
        return NextResponse.json({ ok: true })
      case 'reorderResources':
        await reorderResources(body.ids)
        return NextResponse.json({ ok: true })
      default:
        return NextResponse.json({ error: 'invalid action' }, { status: 400 })
    }
  } catch (e) {
    console.error('Admin error', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
