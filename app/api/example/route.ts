import { NextRequest, NextResponse } from 'next/server'

/**
 * Example API route template
 *
 * Common patterns used in VibeUncle projects:
 * - Forward to n8n webhook
 * - Fetch from Google Sheets
 * - Fetch from Cloudflare R2
 */

// GET handler
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    // Example: Fetch from n8n webhook
    // const response = await fetch(process.env.N8N_GET_URL!, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ id }),
    // })
    // const data = await response.json()

    return NextResponse.json({
      success: true,
      data: { id, message: 'Example GET response' },
    })
  } catch (error) {
    console.error('GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }

    // Example: Forward to n8n webhook
    // const response = await fetch(process.env.N8N_WEBHOOK_URL!, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(body),
    // })
    // const data = await response.json()

    return NextResponse.json({
      success: true,
      data: { ...body, id: 'generated-id' },
    })
  } catch (error) {
    console.error('POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
