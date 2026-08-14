/**
 * Common TypeScript types for VibeUncle projects
 */

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Common entity with timestamps
export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt?: string
}

// User (if using auth)
export interface User extends BaseEntity {
  phone?: string
  email?: string
  name?: string
}

// Project stats (for VibeUncleHeader)
export interface ProjectStats {
  projectId: string
  likes: number
  views: number
}

// N8N Webhook response
export interface WebhookResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// Google Sheets row (generic)
export type SheetRow = Record<string, string>

// Status enum
export type Status = 'pending' | 'in_progress' | 'completed' | 'failed'

export type ShowLinkKind = 'ppt' | 'pdf' | 'video'

export type StorageMode = 'local' | 'r2'

export interface ClassInfo {
  code: string
  name: string
  createdAt: string
  /** 学堂 whose sign-in link this class uses (see School). */
  schoolId?: string
}

/**
 * A 学堂 (academy) as far as sign-in goes: greatpath issues one fixed check-in
 * URL per 学堂 plus a passcode that staff can rotate there. Classes point at a
 * school rather than carrying their own copy, so a rotated passcode is updated
 * in one place.
 */
export interface School {
  id: string
  name: string
  url: string
  passcode: string
  updatedAt: string
}

/**
 * A class's own check-in link. greatpath now issues a per-class link (managed on
 * the class card in 班级管理) alongside the 学堂-wide one, and treats the 学堂 link
 * as the fallback — so this takes precedence over the class's School when set.
 * The class itself maintains it from the class page; it stays until someone
 * there replaces or clears it.
 */
export interface ClassSigninOverride {
  url: string
  passcode: string
  updatedAt: string
}

/** Sign-in config resolved for one class, safe to send to the class page. */
export interface ClassSignin {
  /** 'class' = the class's own link, 'school' = the 学堂 fallback. */
  source: 'class' | 'school'
  /** Heading shown above the 口令: class name or 学堂 name. */
  label: string
  url: string
  passcode: string
  /** Only for source 'school'. */
  schoolId?: string
  /** Only for source 'class'. */
  updatedAt?: string
}

export type MessageTeam = 'all' | '1' | '2' | '3'

export interface MessageTemplate {
  id: string
  title: string
  body: string
  team: MessageTeam
  addedAt: string
  order?: number
}

export interface DedicationPerson {
  id: string
  name: string
  paused: boolean
  addedAt: string
  updatedAt?: string
  source: 'leader' | 'self'
}

export interface DedicationGroup {
  id: string
  purpose: string
  people: DedicationPerson[]
  addedAt: string
  updatedAt?: string
  order?: number
}

/**
 * 定课 — the fixed liturgy a class runs together over Zoom. Content lives in
 * lib/dingke-content.ts; a class can override the wording per section (see
 * DingkeSectionOverride), which is what gets stored in R2.
 */
export interface DingkeAudio {
  src: string
  label: string
  durationSec: number
}

/** A line of the host's script. `dedication` is filled from 回向名单 at render time. */
export type DingkeBlock =
  | { kind: 'cue'; text: string; label?: string }
  | { kind: 'chant'; text: string; label?: string }
  | { kind: 'text'; text: string; label?: string }
  | { kind: 'note'; text: string; label?: string }
  | { kind: 'list'; items: string[]; label?: string }
  | { kind: 'dedication' }

/** The large-type half of the screen — what the whole room reads off the share. */
export interface DingkeSlide {
  /** Small label above the headline. */
  kicker?: string
  headline: string
  lines: string[]
  /** Chant lines get centred, wider-tracked, one line per row. */
  chant?: boolean
}

export interface DingkeSection {
  id: string
  title: string
  subtitle?: string
  slide: DingkeSlide
  blocks: DingkeBlock[]
  audio?: DingkeAudio
  /** Offers a 止静 countdown of this many minutes after the audio. */
  stillnessMinutes?: number
  /** Renders the class's live 回向名单 in place of the `dedication` block. */
  dedication?: boolean
}

/**
 * One class's edits to a section. Anything omitted falls back to the default,
 * so a class that only retitles a section keeps future script updates.
 */
export interface DingkeSectionOverride {
  title?: string
  subtitle?: string
  headline?: string
  /** Replaces DingkeSlide.lines. */
  slideLines?: string[]
  /**
   * Replaces the whole script. Blank-line-separated paragraphs; a paragraph
   * starting with 「主持人白」or「白：」renders as a cue.
   */
  body?: string
  updatedAt: string
}

export type DingkeOverrides = Record<string, DingkeSectionOverride>

export interface OrgActivity {
  id: string
  title: string
  description: string
  date: string
  timeStart: string | null
  timeEnd: string | null
  location: string
  totalSpots: number | null
  availableSpots: number | null
  imageUrl: string | null
}

export interface ShowLink {
  id: string
  title: string
  url: string
  kind: ShowLinkKind
  addedAt: string
  order?: number
  size?: number
  r2Key?: string
  hidden?: boolean
}
