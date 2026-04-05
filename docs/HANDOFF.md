Project Handoff: SimpleFi (PWA Financial Tracker)
Architecture & Core Philosophy
Objective: A "dead simple" financial tracker optimized for zero-friction entry (minimum clicks to log an expense).
UI/UX Strategy: A single-screen flattened architecture. No multi-page routing. Actions are handled via state-driven overlays (bottom sheets). The visual language uses a "Fino-inspired" dark mode with pure CSS data visualization.
Tech Stack:
Frontend: SolidJS, Vite, Tailwind CSS, vite-plugin-pwa. Chosen for zero virtual DOM overhead, native-like rendering speed, and clean component scalability.
Backend: Go 1.22+ (Standard Library Routing), SQLite (mattn/go-sqlite3). Chosen for micro-second response times, zero-dependency deployment, and efficient local-first data aggregation.
Directory Structure
simplefi/
├── backend/                  
│   ├── go.mod
│   ├── go.sum
│   ├── main.go               # Server init, middleware (CORS), router
│   ├── database/             
│   │   └── db.go             # SQLite connection pool and queries
│   ├── handlers/             
│   │   └── transactions.go   # HTTP route handlers
│   └── data.db               # SQLite file (gitignored)
│
└── frontend/                 
    ├── package.json
    ├── vite.config.ts        # Vite PWA plugin configuration
    ├── tailwind.config.js    # Theming & dark mode colors
    ├── index.html
    ├── public/               
    │   ├── manifest.webmanifest
    │   ├── icon-192.png
    │   └── icon-512.png
    └── src/
        ├── index.tsx         # SolidJS mount point
        ├── index.css         # Tailwind directives
        ├── App.tsx           # Main Hub (State container)
        └── components/
            ├── BalanceHeader.tsx    # Sticky top balance display
            ├── TransactionSheet.tsx # Slide-up bottom sheet for data entry
            ├── StatBars.tsx         # CSS-only percentage progress bars
            └── RecentList.tsx       # Mapped <For> list of latest entries

Backend Specifications (Go + SQLite)
Database Schema
A single flat table optimized for fast reads and native SQLite date/category aggregation.
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    type TEXT NOT NULL,          -- 'income' or 'expense'
    category TEXT DEFAULT 'General',
    description TEXT,            -- Optional
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_created_at ON transactions(created_at);
CREATE INDEX idx_category ON transactions(category);

API Endpoints
All endpoints utilize standard JSON payloads and native Go 1.22 routing (GET /path, POST /path).
GET /api/transactions
Purpose: Fetch the chronological feed.
Response: Array of transaction objects.
GET /api/statistics?month=YYYY-MM
Purpose: Offload math from the client. Returns aggregated totals and calculated percentages per category.
Response: [{ "category": "Food", "amount": 450, "percentage": 45.5, "colorTheme": "purple" }, ...]
POST /api/transactions
Purpose: Insert a new entry.
Payload: { "amount": 15.50, "type": "expense", "category": "Food", "description": "Coffee" }
Action: Returns 201 Created and the inserted object.
Frontend Specifications (SolidJS)
State Management
Avoid global stores (Redux/Zustand). Use Solid's native primitives at the App.tsx level and pass them down:
createResource: For asynchronous fetching of /api/transactions and /api/statistics. Allows built-in loading states.
createSignal: For the isSheetOpen boolean and the active view toggle (showStats vs showRecent).
PWA Configuration (vite.config.ts)
Utilize vite-plugin-pwa to handle manifest generation and service worker caching automatically.
import { VitePWA } from 'vite-plugin-pwa';

// Inside vite config plugins array:
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  manifest: {
    name: 'SimpleFi',
    short_name: 'SimpleFi',
    theme_color: '#120F1C', // Matches the Fino dark background
    background_color: '#120F1C',
    display: 'standalone', // Critical for native app feel
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  }
})

UI / UX Implementation Guide
Theming (Tailwind)
Background: Base app background should be #120F1C to replicate the premium dark mode aesthetic.
Accents: Utilize Tailwind's neon palette (purple-500, blue-400, pink-500) for data visualization and the primary Floating Action Button (FAB).
Text: High contrast text-white for primary numbers, text-gray-400 for subtitles and dates.
Component Breakdown
The Hub (App.tsx):
Displays the massive total balance at the top center.
Houses a sticky Floating Action Button (FAB) anchored to the bottom right for the isSheetOpen = true trigger.
The TransactionSheet (Bottom Modal):
Requires CSS transitions: translate-y-full to translate-y-0.
Input: A massive, auto-focused type="number" input. No traditional form fields.
Submission: Two large, touch-friendly buttons at the base: "Spent" (Triggers POST as 'expense') and "Earned" (Triggers POST as 'income').
The StatBars (Data Vis):
Renders the data from /api/statistics.
Implementation: Instead of heavy charting SVGs/Canvas, map over the payload using Solid's <For> component. Render a standard HTML div with class="h-2 rounded-full" and apply an inline style width: ${item.percentage}% with a transition for a smooth loading animation.