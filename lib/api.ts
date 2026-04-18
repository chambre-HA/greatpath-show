/**
 * API utilities for n8n webhook integration
 */

const N8N_BASE = process.env.N8N_WEBHOOK_URL || 'https://api.vibeuncle.com/webhook'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Generic POST request to n8n webhook
 */
export async function postToWebhook<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${N8N_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    console.error(`API error (${endpoint}):`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Fetch data from Google Sheets CSV
 */
export async function fetchFromGoogleSheet<T>(
  sheetUrl: string,
  parser: (rows: string[][]) => T
): Promise<T | null> {
  try {
    const response = await fetch(sheetUrl)
    const text = await response.text()

    const rows = text.split('\n').map(row => {
      // Simple CSV parsing (handles basic cases)
      return row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    })

    return parser(rows.slice(1)) // Skip header row
  } catch (error) {
    console.error('Failed to fetch from Google Sheet:', error)
    return null
  }
}

/**
 * Fetch JSON from Cloudflare R2
 */
export async function fetchFromR2<T>(path: string): Promise<T | null> {
  const baseUrl = process.env.R2_PUBLIC_URL
  if (!baseUrl) {
    console.error('R2_PUBLIC_URL not configured')
    return null
  }

  try {
    const response = await fetch(`${baseUrl}/${path}`, {
      cache: 'no-store', // Always fetch fresh
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to fetch from R2:', error)
    return null
  }
}
