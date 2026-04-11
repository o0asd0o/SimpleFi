import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { clsx as cn } from "clsx";
import { exportTransactions, fetchInvitations } from "../lib/api";
import { type ThemeMode } from "../lib/theme";

type ViewType = "home" | "analytics" | "budgets" | "recurring" | "partnerships";

type Props = {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  onLogout: () => void;
  onClose: () => void;
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  activePartnershipId?: string | null;
  /** When true, renders as a static sidebar (no overlay/fixed/scroll-lock). */
  inline?: boolean;
};

export default function SidebarMenu(props: Props) {
  const [isExporting, setIsExporting] = createSignal(false);

  const invitationsQuery = createQuery(() => ({
    queryKey: ["invitations"],
    queryFn: fetchInvitations,
    enabled: false,
  }));

  const pendingCount = () => invitationsQuery.data?.length ?? 0;

  // Overlay mode only: scroll lock + Escape
  if (!props.inline) {
    const scrollbarOffset = Math.max(
      window.innerWidth - document.documentElement.clientWidth,
      0,
    );
    const previousBodyOverflow = document.body.style.overflow;

    onMount(() => {
      document.body.style.overflow = "hidden";
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") props.onClose();
      };
      window.addEventListener("keydown", onKeyDown);
      onCleanup(() => window.removeEventListener("keydown", onKeyDown));
    });

    onCleanup(() => {
      document.body.style.overflow = previousBodyOverflow;
    });
  }

  const handleNav = (view: ViewType) => {
    props.onNavigate(view);
    if (!props.inline) props.onClose();
  };

  const sidebarContent = (
    <nav
      role={props.inline ? "navigation" : "dialog"}
      aria-modal={props.inline ? undefined : "true"}
      aria-label="Navigation menu"
      class={cn(
        "flex flex-col bg-sheet-bg",
        props.inline
          ? "w-64 h-full border-r border-dim"
          : "fixed inset-y-0 right-0 z-50 w-64 sidebar-panel-enter",
      )}
    >
        {/* Header */}
        <div
          class="px-6 pb-6 border-b border-dim"
          style={{
            "padding-top": "calc(2.5rem + env(safe-area-inset-top, 0px))",
          }}
        >
          <h2 class="text-lg font-bold text-fg">SimpleFi</h2>
        </div>

        {/* Menu items */}
        <div class="flex-1 py-4 px-3">
          <button
            type="button"
            onClick={() => handleNav("home")}
            class={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              props.activeView === "home"
                ? "bg-purple-600/20 text-purple-700 dark:text-purple-400"
                : "text-fg-2 hover:bg-surface hover:text-fg",
            )}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Home
          </button>
          <button
            type="button"
            onClick={() => handleNav("analytics")}
            class={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              props.activeView === "analytics"
                ? "bg-purple-600/20 text-purple-700 dark:text-purple-400"
                : "text-fg-2 hover:bg-surface hover:text-fg",
            )}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Analytics
          </button>
          <button
            type="button"
            onClick={() => handleNav("budgets")}
            class={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              props.activeView === "budgets"
                ? "bg-purple-600/20 text-purple-700 dark:text-purple-400"
                : "text-fg-2 hover:bg-surface hover:text-fg",
            )}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            Budgets
          </button>
          <button
            type="button"
            onClick={() => handleNav("recurring")}
            class={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              props.activeView === "recurring"
                ? "bg-purple-600/20 text-purple-700 dark:text-purple-400"
                : "text-fg-2 hover:bg-surface hover:text-fg",
            )}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Recurring
          </button>
          <button
            type="button"
            onClick={() => handleNav("partnerships")}
            class={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              props.activeView === "partnerships"
                ? "bg-purple-600/20 text-purple-700 dark:text-purple-400"
                : "text-fg-2 hover:bg-surface hover:text-fg",
            )}
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span class="flex-1 text-left">Partnerships</span>
            <Show when={pendingCount() > 0}>
              <span class="bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {pendingCount()}
              </span>
            </Show>
          </button>
        </div>

        {/* Theme toggle + Logout at bottom */}
        <div
          class="px-3 border-t border-dim pt-4 space-y-1"
          style={{
            "padding-bottom": "calc(2.5rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* Export data */}
          <button
            type="button"
            onClick={async () => {
              setIsExporting(true);
              try {
                await exportTransactions(props.activePartnershipId);
              } catch {
                // silently fail — browser will show its own error
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting()}
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-fg-2 hover:bg-surface hover:text-fg transition-colors disabled:opacity-50"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <Show when={isExporting()} fallback={<>Export Data</>}>
              Exporting…
            </Show>
          </button>
          {/* Theme selector */}
          <div class="px-4 py-3">
            <p class="text-xs text-fg-3 uppercase tracking-wider mb-2">Theme</p>
            <div class="flex gap-1 bg-surface rounded-xl p-1">
              <button
                type="button"
                onClick={() => props.onThemeChange("light")}
                class={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  props.theme === "light"
                    ? "bg-purple-600 text-white"
                    : "text-fg-3 hover:text-fg",
                )}
                aria-label="Light mode"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z"
                  />
                </svg>
                Light
              </button>
              <button
                type="button"
                onClick={() => props.onThemeChange("system")}
                class={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  props.theme === "system"
                    ? "bg-purple-600 text-white"
                    : "text-fg-3 hover:text-fg",
                )}
                aria-label="System default"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                System
              </button>
              <button
                type="button"
                onClick={() => props.onThemeChange("dark")}
                class={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  props.theme === "dark"
                    ? "bg-purple-600 text-white"
                    : "text-fg-3 hover:text-fg",
                )}
                aria-label="Dark mode"
              >
                <svg
                  class="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
                Dark
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onLogout}
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-fg-3 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign out
          </button>
        </div>
      </nav>
  );

  if (props.inline) return sidebarContent;

  return (
    <>
      <div
        class="fixed inset-0 z-40 bg-overlay backdrop-blur-sm sidebar-backdrop-enter"
        onClick={props.onClose}
        aria-hidden="true"
      />
      {sidebarContent}
    </>
  );
}
