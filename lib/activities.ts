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

const WEEKDAY_NAMES: Record<string, number> = {
  周日: 0, 星期日: 0,
  周一: 1, 星期一: 1,
  周二: 2, 星期二: 2,
  周三: 3, 星期三: 3,
  周四: 4, 星期四: 4,
  周五: 5, 星期五: 5,
  周六: 6, 星期六: 6,
}

// Mirrors the source site's date resolution: a literal date passes through,
// a recurring weekday label (e.g. "每周二") resolves to its next occurrence
// in Asia/Shanghai (today counts if it's already that weekday).
function resolveUpcomingDate(dateSchedule: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateSchedule)) return dateSchedule

  let weekday: number | null = null
  for (const [label, value] of Object.entries(WEEKDAY_NAMES)) {
    if (dateSchedule.includes(label)) {
      weekday = value
      break
    }
  }
  if (weekday === null) return null

  const now = new Date()
  const shanghaiNow = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60 * 1000)
  const currentWeekday = shanghaiNow.getDay()
  let daysUntil = weekday - currentWeekday
  if (daysUntil < 0) daysUntil += 7

  const target = new Date(shanghaiNow)
  target.setDate(shanghaiNow.getDate() + daysUntil)
  const year = target.getFullYear()
  const month = String(target.getMonth() + 1).padStart(2, '0')
  const day = String(target.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function fetchRegistrationCounts(
  dates: { id: string; date: string }[]
): Promise<Record<string, number>> {
  if (dates.length === 0) return {}

  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-registration-counts`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dates }),
    next: { revalidate: 300 },
  })

  if (!res.ok) return {}
  const data = await res.json()
  return data?.counts || {}
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

  const upcomingDates = rows.map(row => ({ id: row.id, date: resolveUpcomingDate(row.date_schedule) }))
  const validDates = upcomingDates.filter(
    (d): d is { id: string; date: string } => d.date !== null
  )
  const counts = await fetchRegistrationCounts(validDates)

  return rows.map((row, i) => {
    const upcomingDate = upcomingDates[i].date
    const registered = upcomingDate ? counts[`${row.id}_${upcomingDate}`] ?? 0 : 0
    const availableSpots = row.total_spots == null ? null : Math.max(0, row.total_spots - registered)

    return {
      id: row.id,
      title: row.name_zh || row.name_en || '未命名活动',
      description: row.description_zh || row.description_en || '',
      date: row.date_schedule,
      timeStart: row.time_start,
      timeEnd: row.time_end,
      location: row.location_zh || row.location_en || '',
      totalSpots: row.total_spots,
      availableSpots,
      imageUrl: row.image_url,
    }
  })
}
