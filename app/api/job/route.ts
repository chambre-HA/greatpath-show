/**
 * POST /api/job — Submit a new async job to n8n
 *
 * This is an EXAMPLE route. Copy and customize for your project.
 * The n8n webhook must be configured to:
 *   1. Use "Respond to Webhook" node to return { jobId } immediately
 *   2. Continue processing asynchronously
 *   3. Write the result to R2 at /jobs/{jobId}.json when done
 *
 * Request body: your project-specific payload (JSON or FormData)
 * Response: { success: true, jobId: "xxx", estimatedSeconds: 120 }
 */

import { NextRequest, NextResponse } from 'next/server'

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://api.vibeuncle.com/webhook/greatpath-show'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // --- Customize: validate your inputs here ---
    // if (!body.topic) {
    //   return NextResponse.json(
    //     { success: false, error: 'Topic is required' },
    //     { status: 400 }
    //   )
    // }

    // Forward to n8n webhook (responds immediately with jobId)
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`n8n error: ${response.status} ${text.slice(0, 200)}`)
      throw new Error(`n8n returned ${response.status}`)
    }

    const result = await response.json()

    // n8n should return { jobId: "xxx", estimatedSeconds?: number }
    if (!result.jobId) {
      throw new Error('n8n did not return a jobId — check the workflow async configuration')
    }

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      estimatedSeconds: result.estimatedSeconds || 120,
    })
  } catch (error) {
    console.error('Job submission error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to submit job' },
      { status: 500 }
    )
  }
}
