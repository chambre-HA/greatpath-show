# CLAUDE.md - Greatpath Show

## Overview
Fetch and manage links to PPT and PDF files with option to store locally or via R2

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React

## Key Features
- Feature 1
- Feature 2
- Feature 3

## 定课 (guided liturgy)

Replaces `GPGB-同喜定课模板1-18字+慈经 v1.0-20251212.pptx` for the weekly 定课 over
Zoom, which that deck served badly from a phone: several lines were pictures of
calligraphy, the 主持人白 cues were unreadably small, and the two chant tracks were
embedded audio that only plays inside PowerPoint's slideshow mode.

- **Script**: `lib/dingke-content.ts` — 9 sections transcribed from the deck.
  Section ids are stable; per-class overrides key off them.
- **Overrides**: a class can reword any section; stored at
  `<classCode>/dingke.json` in R2. Only fields that actually differ from the
  default are saved, so central script edits still reach classes that tweaked a
  section. Merge/parse logic is in `lib/dingke-resolve.ts`.
- **Audio**: the deck's two MP3s were extracted and uploaded once to
  `shared/dingke/{opening,cijing}.mp3` in the R2 bucket (served publicly via
  `NEXT_PUBLIC_R2_PUBLIC_URL`). They are not in the repo.
- **回向**: the last section pulls the class's live 回向名单 (`/api/dedication`)
  rather than carrying a static name; `{{回向名单}}` is the placeholder in an
  edited script.
- **Layout**: large-type slide beside a host script panel, sized for a phone in
  landscape (hence the portrait nudge and the vh-capped type in `SlidePane`).

## Project Structure
```
app/
├── api/
│   └── example/route.ts    # Example API route
├── layout.tsx              # Root layout
├── page.tsx                # Home page
└── globals.css             # Global styles
components/
├── VibeUncleHeader.tsx     # Engagement tracking header
└── [your components]
lib/
├── api.ts                  # API utilities
└── utils.ts                # Helper functions
types/
└── index.ts                # TypeScript types
```

## Commands
```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/example` | GET/POST | Example endpoint |
| `/api/dingke` | GET/POST | 定课 script: resolved sections; save/reset per-class overrides |

## Environment Variables
```
# N8N Integration
N8N_WEBHOOK_URL=https://api.vibeuncle.com/webhook/greatpath-show

# Storage (optional)
# R2_PUBLIC_URL=https://greatpath-show-assets.vibeuncle.com

# Database (optional)
# NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Started
1. Copy `.env.example` to `.env.local`
2. Fill in environment variables
3. Run `npm install`
4. Run `npm run dev`
