import type { OrgActivity } from '@/types'

// Public data source for https://greatpath-greatbusiness.com/activities
// Uses the same anon (public, read-only) Supabase REST endpoint the site itself
// calls from the browser — no server-side secret involved.
const SUPABASE_URL = process.env.ACTIVITIES_SUPABASE_URL || 'https://zcaqgvxmhrhzhzxrjsnj.supabase.co'
const SUPABASE_ANON_KEY = process.env.ACTIVITIES_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjYXFndnhtaHJoemh6eHJqc25qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTk5ODEsImV4cCI6MjA3ODk3NTk4MX0.uPMd-833Zmdi3lLuqKvlo6x070Y8SADOKvx8IjQ-HQY'

interface ActivityRow {
  id: string
  name_zh: string
  name_en: string | null
  description_zh: string | null
  description_en: string | null
  date_schedule: string
  time_start: string | null
  time_end: string | null
  location_zh: string | null
  location_en: string | null
  total_spots: number | null
  available_spots: number | null
  image_url: string | null
  is_active: boolean
}

export async function fetchOrgActivities(): Promise<OrgActivity[]> {
  const url = `${SUPABASE_URL}/rest/v1/activities?select=id,name_zh,name_en,description_zh,description_en,date_schedule,time_start,time_end,location_zh,location_en,total_spots,available_spots,image_url,is_active&is_active=eq.true&order=date_schedule.asc`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch activities: ${res.status}`)
  }

  const rows: ActivityRow[] = await res.json()

  return rows.map(row => ({
    id: row.id,
    title: row.name_zh || row.name_en || '未命名活动',
    description: row.description_zh || row.description_en || '',
    date: row.date_schedule,
    timeStart: row.time_start,
    timeEnd: row.time_end,
    location: row.location_zh || row.location_en || '',
    totalSpots: row.total_spots,
    availableSpots: row.available_spots,
    imageUrl: row.image_url,
  }))
}
