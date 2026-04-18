'use client'

import { useState, useEffect } from 'react'
import { Heart, Eye, Share2, X } from 'lucide-react'

// Configure these for your project
const PROJECT_ID = 'greatpath-show'
const API_BASE = 'https://api.vibeuncle.com/webhook'
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSvN4ywySe7KwWLKUyq5E8YHgshEVVMGsib31Kk-eCazw56A950fKPxX4Y6-qV1CnGx9laEeSBfjBOo/pub?gid=0&single=true&output=csv'

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function parseVibeUncleCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const obj: Record<string, string> = {}
    headers.forEach((header, index) => {
      obj[header] = values[index]?.trim() || ''
    })
    return obj
  })
}

export function VibeUncleHeader() {
  const [isOpen, setIsOpen] = useState(false)
  const [likes, setLikes] = useState(0)
  const [views, setViews] = useState(0)
  const [hasLiked, setHasLiked] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setHasLiked(localStorage.getItem(`vibeuncle_liked_${PROJECT_ID}`) === 'true')

    // Fetch stats from Google Sheet
    fetch(SHEET_URL)
      .then(res => res.text())
      .then(text => {
        const data = parseVibeUncleCSV(text)
        const project = data.find(p => p.id === PROJECT_ID)
        if (project) {
          setLikes(parseInt(project.likes) || 0)
          setViews(parseInt(project.views) || 0)
        }
      })
      .catch(err => console.error('Error fetching stats:', err))

    // Track view (only once per session)
    const viewKey = `vibeuncle_viewed_${PROJECT_ID}`
    if (!sessionStorage.getItem(viewKey)) {
      setViews(prev => prev + 1)
      fetch(`${API_BASE}/vibeuncle-view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: PROJECT_ID, action: 'view', timestamp: new Date().toISOString() }),
      }).catch(err => console.error('Error sending view:', err))
      sessionStorage.setItem(viewKey, 'true')
    }
  }, [])

  // Expose toggle function globally for the logo to call
  useEffect(() => {
    (window as unknown as { toggleVibeUncleBar?: () => void }).toggleVibeUncleBar = () => setIsOpen(prev => !prev)
    return () => {
      delete (window as unknown as { toggleVibeUncleBar?: () => void }).toggleVibeUncleBar
    }
  }, [])

  const handleLike = () => {
    if (hasLiked) return
    setLikes(prev => prev + 1)
    setHasLiked(true)
    localStorage.setItem(`vibeuncle_liked_${PROJECT_ID}`, 'true')
    fetch(`${API_BASE}/vibeuncle-like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: PROJECT_ID, action: 'like', timestamp: new Date().toISOString() }),
    }).catch(err => console.error('Error sending like:', err))
  }

  const handleShare = async () => {
    const shareData = { title: 'Greatpath Show', text: 'Check out Greatpath Show!', url: window.location.href }
    try {
      if (navigator.share) await navigator.share(shareData)
      else {
        await navigator.clipboard.writeText(window.location.href)
        alert('Link copied to clipboard!')
      }
    } catch (err) {
      console.error('Share failed:', err)
    }
  }

  return (
    <>
      {/* Top Bar */}
      <div
        className={`fixed top-0 left-0 right-0 z-[200] overflow-hidden shadow-lg transition-all duration-300 ease-out ${
          isOpen ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
        }`}
        style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <a
            href="https://vibeuncle.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-bold text-xs tracking-wide hover:underline leading-tight"
          >
            MADE BY<br />VIBEUNCLE.COM
          </a>
          <div className="flex items-center gap-4">
            {/* Donate Button */}
            <a
              href="https://ko-fi.com/vibeuncle"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:scale-110 transition-transform"
            >
              <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24">
                <path d="M20.216 6.415l-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 00-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 00-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 01-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 013.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 01-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 01-4.743.295 37.059 37.059 0 01-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0011.343.376.483.483 0 01.535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 01.39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 01-.169.364zm-6.159 3.9c-.862.37-1.84.788-3.109.788a5.884 5.884 0 01-1.569-.217l.877 9.004c.065.78.717 1.38 1.5 1.38 0 0 1.243.065 1.658.065.447 0 1.786-.065 1.786-.065.783 0 1.434-.6 1.499-1.38l.94-9.95a3.996 3.996 0 00-1.322-.238c-.826 0-1.491.284-2.26.613z"/>
              </svg>
              <span className="text-white font-bold text-sm">Donate</span>
            </a>
            {/* Like Button */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 transition-transform ${hasLiked ? 'cursor-default' : 'hover:scale-110'}`}
            >
              <Heart className={`w-5 h-5 ${hasLiked ? 'fill-white' : ''}`} stroke="white" />
              {mounted && <span className="text-white font-bold text-lg">{likes}</span>}
            </button>
            {/* View Counter */}
            <div className="flex items-center gap-1.5">
              <Eye className="w-5 h-5" stroke="white" />
              {mounted && <span className="text-white font-bold text-lg">{views}</span>}
            </div>
            {/* Share Button */}
            <button onClick={handleShare} className="p-1 hover:bg-white/20 rounded transition-colors">
              <Share2 className="w-5 h-5" stroke="white" />
            </button>
            {/* Close Button */}
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded transition-colors ml-2">
              <X className="w-5 h-5" stroke="white" />
            </button>
          </div>
        </div>
      </div>

      {/* Spacer when bar is open */}
      <div className={`transition-all duration-300 ease-out ${isOpen ? 'h-[52px]' : 'h-0'}`} />
    </>
  )
}
