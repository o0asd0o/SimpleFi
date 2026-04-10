import { registerSW } from "virtual:pwa-register";

const CHECK_INTERVAL_MS = 60_000;
const FOCUS_DEBOUNCE_MS = 1_000;
const API_BASE = import.meta.env.VITE_API_URL ?? "";

let knownVersion: string | null = null;
let sheetOpen = false;
let pendingReload = false;
let isInitialController = true;
let focusTimer: ReturnType<typeof setTimeout> | null = null;

// ── Deferred reload API (consumed by App.tsx) ───────────────
export function setSheetOpen(open: boolean) {
  sheetOpen = open;
  if (!open && pendingReload) {
    doReload();
  }
}

function doReload() {
  sessionStorage.setItem("simplfi-updated", "1");
  window.location.reload();
}

function triggerReload() {
  if (sheetOpen) {
    pendingReload = true;
    return;
  }
  doReload();
}

// ── Version polling ─────────────────────────────────────────
async function checkVersion() {
  try {
    const res = await fetch(`${API_BASE}/api/version`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { version: string };
    if (knownVersion === null) {
      knownVersion = data.version;
      return;
    }
    if (data.version !== knownVersion) {
      triggerReload();
    }
  } catch {
    // Network error — ignore, will retry on next check
  }
}

// ── SW registration ─────────────────────────────────────────
let swRegistration: ServiceWorkerRegistration | undefined;

function checkSW() {
  swRegistration?.update().catch(() => {});
}

function runChecks() {
  checkSW();
  checkVersion();
}

registerSW({
  onRegisteredSW(_swUrl: string, registration?: ServiceWorkerRegistration) {
    swRegistration = registration;

    // Timer-based polling (secondary — freezes on iOS background, that's OK)
    setInterval(runChecks, CHECK_INTERVAL_MS);
  },
});

// ── controllerchange → reload ───────────────────────────────
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (isInitialController) {
      isInitialController = false;
      return;
    }
    triggerReload();
  });
}

// ── Event-driven checks (PRIMARY — critical for iOS) ────────

// visibilitychange: #1 trigger on iOS when user switches back to PWA
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    runChecks();
  }
});

// pageshow: fires when iOS resumes a frozen standalone PWA from bfcache
window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    runChecks();
  }
});

// online: offline → online transition
window.addEventListener("online", () => {
  runChecks();
});

// focus: debounced to avoid duplicate with visibilitychange
window.addEventListener("focus", () => {
  if (focusTimer) clearTimeout(focusTimer);
  focusTimer = setTimeout(() => {
    runChecks();
    focusTimer = null;
  }, FOCUS_DEBOUNCE_MS);
});

// ── Initial version check on boot ───────────────────────────
checkVersion();
