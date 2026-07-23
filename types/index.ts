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
