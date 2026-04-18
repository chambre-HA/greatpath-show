'use client'

/**
 * useAsyncJob — React hook for the async job lifecycle
 *
 * Handles: submit → get jobId → poll for status → complete/error
 * Works with any Next.js API route pair (submit + status).
 *
 * Usage:
 *   const job = useAsyncJob<MyResultType>({
 *     submitUrl: '/api/generate',
 *     statusUrl: '/api/generate/status',
 *     onComplete: (data) => router.push(`/result/${data.id}`),
 *   })
 *
 *   // In your form handler:
 *   await job.submit({ topic: 'Photosynthesis', level: 'O-Level' })
 *
 *   // In your JSX:
 *   <ProcessingScreen status={job.status} elapsed={job.elapsed} ... />
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { JobStatus, JobSubmitResponse, JobStatusResponse, AsyncJobConfig } from './types'

interface UseAsyncJobReturn<T> {
  /** Start the job with given payload */
  submit: (payload: Record<string, unknown> | FormData) => Promise<void>
  /** Current job status */
  status: JobStatus
  /** Result data when complete */
  data: T | null
  /** Error message if failed */
  error: string | null
  /** Job ID for the current job */
  jobId: string | null
  /** Elapsed seconds since submission */
  elapsed: number
  /** Estimated total seconds */
  estimatedSeconds: number
  /** Reset to idle state */
  reset: () => void
}

export function useAsyncJob<T = unknown>(config: AsyncJobConfig<T>): UseAsyncJobReturn<T> {
  const {
    submitUrl,
    statusUrl,
    pollInterval = 5000,
    maxPolls = 120,
    estimatedSeconds: defaultEstimate = 120,
    onComplete,
    onError,
  } = config

  const [status, setStatus] = useState<JobStatus>('idle')
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [estimatedSeconds, setEstimatedSeconds] = useState(defaultEstimate)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)

  // Cleanup function
  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    pollCountRef.current = 0
  }, [])

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup])

  // Start elapsed timer when processing
  useEffect(() => {
    if (status === 'processing') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
      return () => {
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }
  }, [status])

  // Reset to idle
  const reset = useCallback(() => {
    cleanup()
    setStatus('idle')
    setData(null)
    setError(null)
    setJobId(null)
    setElapsed(0)
    setEstimatedSeconds(defaultEstimate)
  }, [cleanup, defaultEstimate])

  // Poll for job status
  const startPolling = useCallback((id: string) => {
    pollCountRef.current = 0

    pollRef.current = setInterval(async () => {
      pollCountRef.current++

      if (pollCountRef.current > maxPolls) {
        cleanup()
        const msg = 'Processing timed out. Please try again.'
        setError(msg)
        setStatus('error')
        onError?.(msg)
        return
      }

      try {
        const res = await fetch(`${statusUrl}?jobId=${id}`)
        if (!res.ok) return // Keep polling on network errors

        const result: JobStatusResponse<T> = await res.json()

        if (result.status === 'complete' && result.data) {
          cleanup()
          setData(result.data)
          setStatus('complete')
          onComplete?.(result.data)
        } else if (result.status === 'error') {
          cleanup()
          const msg = result.error || 'Processing failed'
          setError(msg)
          setStatus('error')
          onError?.(msg)
        }
        // 'processing' → keep polling
      } catch {
        // Network error — keep polling silently
      }
    }, pollInterval)
  }, [statusUrl, pollInterval, maxPolls, cleanup, onComplete, onError])

  // Submit a new job
  const submit = useCallback(async (payload: Record<string, unknown> | FormData) => {
    cleanup()
    setStatus('submitting')
    setError(null)
    setData(null)
    setElapsed(0)

    try {
      const isFormData = payload instanceof FormData
      const res = await fetch(submitUrl, {
        method: 'POST',
        ...(isFormData
          ? { body: payload }
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }
        ),
      })

      if (!res.ok) {
        throw new Error(`Submit failed: ${res.statusText}`)
      }

      const result: JobSubmitResponse = await res.json()

      if (!result.success || !result.jobId) {
        throw new Error(result.error || 'No jobId returned from server')
      }

      setJobId(result.jobId)
      if (result.estimatedSeconds) {
        setEstimatedSeconds(result.estimatedSeconds)
      }
      setStatus('processing')
      startPolling(result.jobId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit job'
      setError(msg)
      setStatus('error')
      onError?.(msg)
    }
  }, [submitUrl, cleanup, startPolling, onError])

  return {
    submit,
    status,
    data,
    error,
    jobId,
    elapsed,
    estimatedSeconds,
    reset,
  }
}
