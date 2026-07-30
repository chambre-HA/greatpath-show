// Live check-in roster for the class-session sign-in QR (SignInQrPanel).
// Reuses the same public Supabase project/anon key as lib/activities.ts —
// this app has no Supabase client of its own, so it calls greatpath's
// public get-class-session-checkins Edge Function instead.
const SUPABASE_URL = process.env.ACTIVITIES_SUPABASE_URL || 'https://zcaqgvxmhrhzhzxrjsnj.supabase.co'
const SUPABASE_ANON_KEY = process.env.ACTIVITIES_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjYXFndnhtaHJoemh6eHJqc25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTk5ODEsImV4cCI6MjA3ODk3NTk4MX0.uPMd-833Zmdi3lLuqKvlo6x070Y8SADOKvx8IjQ-HQY'

export type SessionType = '定课' | '班修' | '组修'

export interface ClassCheckinsParams {
  className: string
  sessionDate: string
  sessionType: SessionType
  sessionPeriod?: 'morning' | 'evening' | null
  groupNumber?: number | null
}

export interface ClassCheckinsResult {
  count: number
  names: string[]
}

// no-store: this is a live, frequently-polled display, never cacheable.
export async function fetchClassSessionCheckins(
  params: ClassCheckinsParams
): Promise<ClassCheckinsResult> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-class-session-checkins`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
    cache: 'no-store',
  })

  if (!res.ok) return { count: 0, names: [] }
  const data = await res.json()
  return { count: data?.count ?? 0, names: data?.names ?? [] }
}
