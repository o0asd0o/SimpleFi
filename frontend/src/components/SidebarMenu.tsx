import { onCleanup, onMount } from "solid-js";
import { cn } from "../lib/cn";

type Props = {
  activeView: "home" | "analytics";
  onNavigate: (view: "home" | "analytics") => void;
  onLogout: () => void;
  onClose: () => void;
};

export default function SidebarMenu(props: Props) {
  onMount(() => {
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  onCleanup(() => {
    document.body.style.overflow = "";
  });

  const handleNav = (view: "home" | "analytics") => {
    props.onNavigate(view);
    props.onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        class="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm sidebar-backdrop"
        onClick={props.onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <nav
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        class="fixed inset-y-0 right-0 z-50 w-64 bg-sheet-bg flex flex-col sidebar-enter"
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
