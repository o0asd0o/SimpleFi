import { onCleanup, onMount, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { cn } from "../lib/cn";
import { fetchInvitations } from "../lib/api";

type ViewType = "home" | "analytics" | "recurring" | "partnerships";

type Props = {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  onLogout: () => void;
  onClose: () => void;
};

export default function SidebarMenu(props: Props) {
  const scrollbarOffset = Math.max(
    window.innerWidth - document.documentElement.clientWidth,
    0,
  );
  const previousBodyOverflow = document.body.style.overflow;

  const invitationsQuery = createQuery(() => ({
    queryKey: ["invitations"],
    queryFn: fetchInvitations,
    refetchInterval: 30000,
  }));

  const pendingCount = () => invitationsQuery.data?.length ?? 0;

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

  const handleNav = (view: ViewType) => {
    props.onNavigate(view);
    props.onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        class={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sidebar-backdrop-enter",
        )}
        onClick={props.onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <nav
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        class="fixed inset-y-0 z-50 flex w-64 flex-col bg-sheet-bg sidebar-panel-enter"
        style={{ right: `${scrollbarOffset}px` }}
      >
        {/* Header */}
        <div class="px-6 pt-10 pb-6 border-b border-white/5">
          <h2 class="text-lg font-bold text-white">SimpleFi</h2>
        </div>

        {/* Menu items */}
        <div class="flex-1 py-4 px-3">
          <button
            type="button"
            onClick={() => handleNav("home")}
            class={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              props.activeView === "home"
                ? "bg-purple-600/20 text-purple-400"
                : "text-gray-400 hover:bg-white/5 hover:text-white",
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
                ? "bg-purple-600/20 text-purple-400"
                : "text-gray-400 hover:bg-white/5 hover:text-white",
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
            onClick={() => handleNav("recurring")}
            class={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
              props.activeView === "recurring"
                ? "bg-purple-600/20 text-purple-400"
                : "text-gray-400 hover:bg-white/5 hover:text-white",
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
                ? "bg-purple-600/20 text-purple-400"
                : "text-gray-400 hover:bg-white/5 hover:text-white",
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

        {/* Logout at bottom */}
        <div class="px-3 pb-10 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={props.onLogout}
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
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
    </>
  );
}
