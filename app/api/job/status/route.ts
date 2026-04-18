/**
 * GET /api/job/status?jobId=xxx — Poll R2 for async job result
 *
 * This route checks Cloudflare R2 for the result JSON written by n8n.
 * Returns: { status: 'processing' | 'complete' | 'error', data?, error? }
 *
 * The n8n workflow writes to: R2_PUBLIC_URL/jobs/{jobId}.json
 */

import { NextRequest, NextResponse } from 'next/server'

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json(
      { status: 'error', error: 'jobId is required' },
      { status: 400 }
    )
  }

  // Validate jobId format to prevent path traversal
  // Adjust this regex to match your jobId format
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(jobId)) {
    return NextResponse.json(
      { status: 'error', error: 'Invalid jobId format' },
      { status: 400 }
    )
  }

  if (!R2_PUBLIC_URL) {
    return NextResponse.json(
      { status: 'error', error: 'R2 storage not configured' },
      { status: 500 }
    )
  }

  try {
    const r2Url = `${R2_PUBLIC_URL}/jobs/${jobId}.json`
    const res = await fetch(r2Url, { cache: 'no-store' })

    // 404 = n8n hasn't written the result yet → still processing
    if (res.status === 404 || res.status === 403) {
      return NextResponse.json({ status: 'processing' })
    }

    if (!res.ok) {
      console.error(`[job/status] R2 fetch error: ${res.status}`)
      return NextResponse.json({ status: 'processing' })
    }

    const data = await res.json()

    // Check if n8n wrote an error
    if (data.success === false || data.error) {
      return NextResponse.json({
        status: 'error',
        error: data.error || 'Generation failed',
      })
    }

    // --- Customize: validate/transform your result shape here ---
    // Example: check that the expected data fields exist
    // if (!data.guide && !data.mindMap && !data.trip) {
    //   return NextResponse.json({
    //     status: 'error',
    //     error: 'Unexpected response shape from AI',
    //   })
    // }

    return NextResponse.json({
      status: 'complete',
      data,
    })
  } catch (error) {
    console.error('Status check error:', error)
    // Treat fetch errors as "still processing" to keep polling
    return NextResponse.json({ status: 'processing' })
  }
}
