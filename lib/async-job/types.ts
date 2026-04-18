/**
 * Async Job Pattern — Shared Types
 *
 * Standard types for the submit → poll → complete lifecycle
 * used across all VibeUncle projects with long-running n8n AI agents.
 */

export type JobStatus = 'idle' | 'submitting' | 'processing' | 'complete' | 'error'

/** Response from the job submission endpoint (POST /api/job) */
export interface JobSubmitResponse {
  success: boolean
  jobId?: string
  estimatedSeconds?: number
  error?: string
}

/** Response from the job status endpoint (GET /api/job/status?jobId=xxx) */
export interface JobStatusResponse<T = unknown> {
  status: 'processing' | 'complete' | 'error'
  data?: T
  error?: string
}

/** Configuration for the useAsyncJob hook */
export interface AsyncJobConfig<T> {
  /** URL to POST the job submission (e.g., '/api/generate') */
  submitUrl: string
  /** URL to GET job status (e.g., '/api/generate/status') */
  statusUrl: string
  /** Polling interval in ms (default: 5000) */
  pollInterval?: number
  /** Max polling attempts before timeout (default: 120 = 10 min at 5s) */
  maxPolls?: number
  /** Default estimated time in seconds (default: 120) */
  estimatedSeconds?: number
  /** Callback when job completes successfully */
  onComplete?: (data: T) => void
  /** Callback on error */
  onError?: (error: string) => void
}
