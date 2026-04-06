import { createSignal, lazy, Show, Suspense } from "solid-js";
import { useQueryClient } from "@tanstack/solid-query";
import { type AuthResponse, type Transaction } from "./lib/api";

// Eager — always visible on home
import BalanceHeader from "./components/BalanceHeader";
import AccountStrip from "./components/AccountStrip";
import RecentList from "./components/RecentList";

// Lazy — loaded on demand
const StatBars = lazy(() => import("./components/StatBars"));
const RecurringList = lazy(() => import("./components/RecurringList"));
const TransactionSheet = lazy(() => import("./components/TransactionSheet"));
const SidebarMenu = lazy(() => import("./components/SidebarMenu"));
const LoginScreen = lazy(() => import("./components/LoginScreen"));
const PassphraseModal = lazy(() => import("./components/PassphraseModal"));

export default function App() {
  const [token, setToken] = createSignal(localStorage.getItem("token"));
  const [passphrase, setPassphrase] = createSignal<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = createSignal(false);
  const [editingTx, setEditingTx] = createSignal<Transaction | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);
  const [activeView, setActiveView] = createSignal<
    "home" | "analytics" | "recurring"
  >("home");
  const queryClient = useQueryClient();

  const handleAuthSuccess = (response: AuthResponse) => {
    localStorage.setItem("token", response.token);
    setToken(response.token);
    if (response.passphrase) {
      setPassphrase(response.passphrase);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    queryClient.clear();
    setIsSidebarOpen(false);
  };

  return (
    <Suspense
      fallback={
        <div class="min-h-screen bg-app-bg flex items-center justify-center">
          <div class="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <Show
        when={token()}
        fallback={<LoginScreen onAuthSuccess={handleAuthSuccess} />}
      >
        <div class="min-h-screen bg-app-bg text-white max-w-md mx-auto relative pb-28">
          <BalanceHeader onMenuOpen={() => setIsSidebarOpen(true)} />

          <Show when={activeView() === "home"}>
            <AccountStrip />
            <RecentList
              onEdit={(tx) => {
                setEditingTx(tx);
                setIsSheetOpen(true);
              }}
            />
          </Show>

          <Show when={activeView() === "analytics"}>
            <StatBars />
          </Show>

          <Show when={activeView() === "recurring"}>
            <RecurringList />
          </Show>

          {/* FAB */}
          <button
            type="button"
            aria-label="Add transaction"
            onClick={() => {
              setEditingTx(null);
              setIsSheetOpen(true);
            }}
            class="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 active:scale-95 text-white shadow-lg shadow-purple-900/50 flex items-center justify-center text-2xl font-light transition-all"
          >
            +
          </button>

          {/* Transaction sheet */}
          <Show when={isSheetOpen()}>
            <TransactionSheet
              editTransaction={editingTx() ?? undefined}
              onClose={() => {
                setIsSheetOpen(false);
                setEditingTx(null);
              }}
            />
          </Show>

          {/* Sidebar menu */}
          <Show when={isSidebarOpen()}>
            <SidebarMenu
              activeView={activeView()}
              onNavigate={setActiveView}
              onLogout={handleLogout}
              onClose={() => setIsSidebarOpen(false)}
            />
          </Show>

          {/* Passphrase modal (shown once after registration) */}
          <Show when={passphrase()}>
            <PassphraseModal
              passphrase={passphrase()!}
              onConfirm={() => setPassphrase(null)}
            />
          </Show>
        </div>
      </Show>
    </Suspense>
  );
}
