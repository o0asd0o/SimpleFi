# Phase 5: PWA + Production Polish

**Depends on**: Phase 4 (fully functional app)

## Goal

The app is installable as a PWA, works offline (shell loads), has proper icons and manifest, and produces a clean production build.

## Files to Create

| File                           | Purpose            |
| ------------------------------ | ------------------ |
| `frontend/public/icon-192.png` | PWA icon 192×192px |
| `frontend/public/icon-512.png` | PWA icon 512×512px |

## Files to Modify

| File                      | Change                                  |
| ------------------------- | --------------------------------------- |
| `frontend/package.json`   | Add `vite-plugin-pwa` dev dependency    |
| `frontend/vite.config.ts` | Add `VitePWA(...)` plugin configuration |
| `frontend/index.html`     | Add Apple PWA meta tags                 |
| `frontend/src/App.tsx`    | Add error state fallbacks for offline   |

## Implementation Details

### Icons

Generate minimal placeholder icons (192×192 and 512×512 PNG):

- Solid `#120F1C` background with "SF" text in purple or white
- Any image editor, online generator, or canvas script works
- Must be actual PNG files at the correct paths — not SVG

### Install `vite-plugin-pwa`

```bash
cd frontend && npm install -D vite-plugin-pwa
```

### `vite.config.ts` — Add PWA plugin

```ts
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    solidPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "SimpleFi",
        short_name: "SimpleFi",
        description: "Dead simple financial tracker",
        theme_color: "#120F1C",
        background_color: "#120F1C",
        display: "standalone",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
    }),
  ],
});
```

> **Dev note**: `vite-plugin-pwa` does not generate the service worker in dev mode by default. Test PWA behavior after `npm run build` + serving `dist/`.

### `index.html` — Apple meta tags

Add inside `<head>`:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta
  name="apple-mobile-web-app-status-bar-style"
  content="black-translucent"
/>
<meta name="apple-mobile-web-app-title" content="SimpleFi" />
<link rel="apple-touch-icon" href="/icon-192.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

These are required for iOS Safari "Add to Home Screen" to work correctly alongside the Web App Manifest.

### `App.tsx` — Offline error states

Add fallbacks for when `createResource` errors (network offline or backend down):

```tsx
<Show when={transactions.error}>
  <p class="text-gray-400 text-center py-4">
    Could not load transactions. Check your connection.
  </p>
</Show>

<Show when={statistics.error}>
  <p class="text-gray-400 text-center py-4">
    Could not load statistics.
  </p>
</Show>
```

This prevents a blank/broken screen when the API is unreachable.

## Verify

### Production Build

```bash
cd frontend && npm run build
```

`dist/` should contain:

- `index.html`
- JS and CSS bundles (hashed filenames)
- `manifest.webmanifest`
- `sw.js` (service worker)
- `icon-192.png`, `icon-512.png`

### PWA Checks (Chrome DevTools)

1. **Manifest**: DevTools → Application → Manifest → icons and metadata display correctly
2. **Service worker**: Application → Service Workers → status is "activated and running"
3. **Install**: URL bar shows install icon → click to install → app opens as standalone window with `#120F1C` title bar
4. **Offline**: DevTools → Network → check "Offline" → reload → app shell renders, error state messages appear (not browser offline page)

### Lighthouse Audit

Open Chrome DevTools → Lighthouse → run PWA audit with "Mobile" device selected.

Target: all PWA criteria green (installable, service worker registered, HTTPS-ready, icons present, manifest valid).

## Gotchas

- **Stale service worker in dev**: If you see stale content, hard-refresh (`Ctrl+Shift+R`) or unregister the SW in DevTools → Application → Service Workers → "Unregister".
- **Icon paths**: manifest `src` must match paths in `public/`. Use `/icon-192.png` (with leading slash).
- **iOS Safari**: Does not support the manifest `display: standalone` on its own — the `apple-mobile-web-app-capable` meta tag is the fallback.
- **`purpose: "any maskable"`**: Adding this to one icon entry allows Android to use adaptive icons. Use a centered design with padding so it doesn't get clipped.
- **NetworkFirst strategy timeout**: `networkTimeoutSeconds: 5` means the service worker will fall back to cache after 5 seconds if the network is slow. Adjust for your expected backend latency.

## Optional: Single-Binary Deploy

When ready for production, the Go backend can serve the frontend `dist/` folder:

```go
// In main.go, after API routes:
distFS, _ := fs.Sub(embeddedDist, "dist")       // embed at build time
mux.Handle("/", http.FileServer(http.FS(distFS)))
```

With `//go:embed dist/*` and `cd frontend && npm run build` run before `go build`, the entire app ships as a single binary — no separate web server needed.
