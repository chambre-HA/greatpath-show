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
  /** 定课 script this class runs (see DingkeVariant). Unset = the built-in default script. */
  dingkeVariantId?: string
}

/**
 * A class's own check-in link and 口令. Greatpath issues one per class — there
 * is no shared/学堂-wide fallback. Editable from the class's own page (no
 * admin password needed there) or from the admin panel; whichever saves last
 * wins, same object either way.
 */
export interface ClassSigninOverride {
  url: string
  passcode: string
  updatedAt: string
}

/** Sign-in config resolved for one class, safe to send to the class page. Null when the class hasn't set one yet. */
export interface ClassSignin {
  /** Heading shown above the 口令 — the class's own name. */
  label: string
  url: string
  passcode: string
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

/** A longer teaching video a section plays inline, alongside (not instead of) the room's slide. */
export interface DingkeVideo {
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

/**
 * The large-type half of the screen — what the whole room reads off the share.
 *
 * Deliberately flat, mirroring phone-dingke.pptx: every slide there is a small
 * amber label followed by same-size body lines, with no separate headline tier.
 */
export interface DingkeSlide {
  /** Small label opening the slide. */
  kicker?: string
  /**
   * One line per row. A line starting with `#` renders as a further small label,
   * which is how a slide shows several named groups in sequence — 十八字方针 above
   * its three lines, then 修学态度 above the three attitudes.
   */
  lines: string[]
}

export interface DingkeSection {
  id: string
  title: string
  subtitle?: string
  slide: DingkeSlide
  blocks: DingkeBlock[]
  audio?: DingkeAudio
  /** Puts the player above the script — for 开场, where the music leads. */
  audioFirst?: boolean
  /** A teaching video the room watches together — renders in the slide half, player included. */
  video?: DingkeVideo
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

/**
 * A full, independent 定课 script — its own complete section list, not a patch
 * on top of DEFAULT_DINGKE_SECTIONS. Classes with substantially different flows
 * (different sections, counts, order) point at one of these via
 * ClassInfo.dingkeVariantId instead of getting the built-in default. A class
 * can still layer its own DingkeSectionOverride edits on top of whichever base
 * (variant or default) it resolves to.
 */
export interface DingkeVariant {
  id: string
  name: string
  sections: DingkeSection[]
  updatedAt: string
}

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

/**
 * One entry in 常用资源 — a global, class-agnostic list of hyperlinks the
 * admin curates and every class sees the same copy of, grouped by category.
 * Unlike ShowLink these are never uploaded files, just plain links.
 */
export interface ResourceLink {
  id: string
  category: string
  name: string
  url: string
  addedAt: string
  order?: number
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
  /** Admin-assigned categories. A doc with none shows under 未分类 wherever tags are grouped. */
  tags?: string[]
}
