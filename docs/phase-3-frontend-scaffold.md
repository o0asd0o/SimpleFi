# Phase 3: Frontend Scaffold (Vite + SolidJS + Tailwind + API)

**Depends on**: Phase 2 (backend must be running on `:8080`)

## Goal

SolidJS app running on `:5173` with the dark theme applied, the API fetch layer working, and a basic App shell that successfully loads and displays data from the backend. Not pretty yet — just wired up end-to-end.

## Files to Create

| File                          | Purpose                                           |
| ----------------------------- | ------------------------------------------------- |
| `frontend/package.json`       | Dependencies and scripts                          |
| `frontend/tsconfig.json`      | TypeScript strict config for SolidJS              |
| `frontend/vite.config.ts`     | Vite + vite-plugin-solid                          |
| `frontend/tailwind.config.js` | Theme tokens (or CSS config if Tailwind v4)       |
| `frontend/index.html`         | HTML shell                                        |
| `frontend/src/index.tsx`      | SolidJS mount point                               |
| `frontend/src/index.css`      | Tailwind directives + base body styles            |
| `frontend/src/App.tsx`        | Signal hub — renders raw JSON to verify data flow |
| `frontend/src/lib/api.ts`     | Fetch wrappers for all 3 endpoints                |

## Implementation Details

### Tailwind Version Check

**Before writing config**, check which version installs:

```bash
npm install tailwindcss && npx tailwindcss --version
```

- **v3**: Use `postcss.config.js` with `tailwindcss` + `autoprefixer` plugins. Use `tailwind.config.js` with `content` array.
- **v4**: Use `@tailwindcss/vite` as a Vite plugin. Configure via `@theme` in CSS, not `tailwind.config.js`.

### `tsconfig.json` critical settings

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}
```

`jsxImportSource: "solid-js"` is required — using `"react"` (the default) breaks SolidJS reactivity.

### `vite.config.ts`

```ts
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  plugins: [solidPlugin()],
});
```

PWA plugin added in Phase 5.

### Tailwind Theme (v3)

In `tailwind.config.js`, extend the color palette:

```js
extend: {
  colors: {
    'app-bg': '#120F1C',
  }
}
```

Body/root: `bg-app-bg min-h-screen text-white font-sans`

Accent colors use Tailwind built-ins: `purple-500`, `blue-400`, `pink-500`.

### `lib/api.ts`

Three exported async functions using `VITE_API_URL` env var:

```ts
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export async function fetchTransactions(): Promise<Transaction[]>;
export async function createTransaction(
  data: CreateTransactionPayload,
): Promise<Transaction>;
export async function fetchStatistics(month: string): Promise<CategoryStat[]>;
```

- `createTransaction` sends `POST` with `Content-Type: application/json`
- All functions throw on non-OK responses (let `createResource` error state handle it)
- Define `Transaction` and `CategoryStat` types inline in this file with `type` (not `interface`)

### `App.tsx` scaffold

Signal hub — all state lives here, passed down as props (per CLAUDE.md):

```ts
const [transactions, { refetch: refetchTx }] =
  createResource(fetchTransactions);
const [currentMonth, setCurrentMonth] = createSignal(todayMonth()); // YYYY-MM
const [statistics] = createResource(currentMonth, fetchStatistics);
const [isSheetOpen, setIsSheetOpen] = createSignal(false);
const [showStats, setShowStats] = createSignal(false);
```

For now, render: `<pre>{JSON.stringify(transactions(), null, 2)}</pre>`

## Verify

```bash
cd frontend && npm install && npm run dev   # Starts on :5173, no errors
```

With backend running on `:8080`:

- Browser shows dark `#120F1C` background with white text
- Raw transaction JSON renders on screen (proves createResource + fetch + CORS all work)
- No red errors in browser console
- `npx tsc --noEmit` — no TypeScript errors

## Gotchas

- `VITE_API_URL` is baked in at build time (Vite replaces `import.meta.env.*` statically). For dev, the `localhost:8080` default works fine.
- `vite-plugin-solid` must be listed in Vite plugins or JSX won't compile.
- SolidJS `createResource` returns `[signal, { refetch, mutate }]`. The signal is a function — always call it as `transactions()`, never use it as a raw value.
