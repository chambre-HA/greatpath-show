'use client'

/**
 * ProcessingScreen — Shared UI for async job waiting state
 *
 * Shows: spinner, title, progress bar, rotating messages, elapsed timer.
 * Each project customizes: title, subtitle, statusMessages array.
 *
 * Usage:
 *   <ProcessingScreen
 *     status={job.status}
 *     elapsed={job.elapsed}
 *     estimatedSeconds={job.estimatedSeconds}
 *     title="Crafting Your Study Guide"
 *     subtitle="Photosynthesis · O-Level"
 *     statusMessages={['Summarizing key concepts...', 'Creating memory hooks...']}
 *     error={job.error}
 *     onRetry={job.reset}
 *     onBack={() => router.push('/')}
 *   />
 */

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { JobStatus } from '@/lib/async-job/types'

const DEFAULT_MESSAGES = [
  'AI agents are working on your request...',
  'Processing your input...',
  'Analyzing and generating content...',
  'Almost there, putting things together...',
  'Running quality checks...',
]

interface ProcessingScreenProps {
  /** Current job status */
  status: JobStatus
  /** Seconds elapsed since job started */
  elapsed: number
  /** Estimated total seconds */
  estimatedSeconds: number
  /** Main title shown during processing */
  title?: string
  /** Subtitle (e.g., topic name, destination) */
  subtitle?: string
  /** Custom icon component to show in spinner area */
  icon?: React.ReactNode
  /** Rotating status messages shown during processing */
  statusMessages?: string[]
  /** Error message when status is 'error' */
  error?: string | null
  /** Called when user clicks "Try Again" */
  onRetry?: () => void
  /** Called when user clicks "Back" */
  onBack?: () => void
  /** Success message shown briefly before redirect */
  successMessage?: string
  /** Accent color for progress bar (CSS value, default: teal) */
  accentColor?: string
}

export function ProcessingScreen({
  status,
  elapsed,
  estimatedSeconds,
  title = 'Processing Your Request',
  subtitle,
  icon,
  statusMessages = DEFAULT_MESSAGES,
  error,
  onRetry,
  onBack,
  successMessage = 'Done! Redirecting...',
  accentColor = '#2a9d8f',
}: ProcessingScreenProps) {
  const [msgIndex, setMsgIndex] = useState(0)

  // Rotate status messages every 4 seconds
  useEffect(() => {
    if (status !== 'processing' && status !== 'submitting') return
    const interval = setInterval(() => {
      setMsgIndex(i => (i + 1) % statusMessages.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [status, statusMessages.length])

  const progress = Math.min((elapsed / estimatedSeconds) * 100, 95)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const estMinutes = Math.ceil(estimatedSeconds / 60)

  const isWorking = status === 'processing' || status === 'submitting'
  const isComplete = status === 'complete'
  const isError = status === 'error'

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">

        {/* Status icon */}
        <div className="relative mx-auto w-20 h-20">
          {isWorking && (
            <>
              <div
                className="absolute inset-0 rounded-full border-4 opacity-20"
                style={{ borderColor: accentColor }}
              />
              <div
                className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
                style={{ borderColor: accentColor, borderTopColor: 'transparent' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {icon || <Loader2 className="w-8 h-8 animate-pulse" style={{ color: accentColor }} />}
              </div>
            </>
          )}
          {isComplete && (
            <CheckCircle2 className="w-20 h-20 text-green-500" />
          )}
          {isError && (
            <AlertCircle className="w-20 h-20 text-red-500" />
          )}
        </div>

        {/* Title */}
        <div>
          {isWorking && (
            <>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                {title}
              </h1>
              {subtitle && (
                <p className="text-gray-500 dark:text-gray-400">{subtitle}</p>
              )}
            </>
          )}
          {isComplete && (
            <h1 className="text-2xl font-bold text-green-600 dark:text-green-400">
              {successMessage}
            </h1>
          )}
          {isError && (
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">
              Something went wrong
            </h1>
          )}
        </div>

        {/* Progress bar */}
        {isWorking && (
          <div className="space-y-3">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${accentColor}, ${accentColor}dd)`,
                }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-400 dark:text-gray-500">
              <span>{minutes}:{seconds.toString().padStart(2, '0')} elapsed</span>
              <span>~{estMinutes} min</span>
            </div>
          </div>
        )}

        {/* Rotating status messages */}
        {isWorking && (
          <p className="text-sm text-gray-400 dark:text-gray-500 h-6 italic transition-opacity duration-500">
            {statusMessages[msgIndex]}
          </p>
        )}

        {/* Error details + actions */}
        {isError && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
            <div className="flex gap-3 justify-center">
              {onBack && (
                <button
                  onClick={onBack}
                  className="px-6 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Back
                </button>
              )}
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
                  style={{ background: accentColor }}
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}

        {/* Reassurance note */}
        {isWorking && (
          <p className="text-xs text-gray-400 dark:text-gray-600 opacity-60">
            You can leave this page — results will appear when ready.
          </p>
        )}
      </div>
    </div>
  )
}
