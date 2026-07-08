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
