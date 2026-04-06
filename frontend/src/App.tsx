import { createSignal, lazy, Show, Suspense } from "solid-js";
import { useQueryClient } from "@tanstack/solid-query";
import { type AuthResponse, type Transaction } from "./lib/api";

// Eager — always visible or always-present UI
import BalanceHeader from "./components/BalanceHeader";
import AccountStrip from "./components/AccountStrip";
import RecentList from "./components/RecentList";
import TransactionSheet from "./components/TransactionSheet";
import SidebarMenu from "./components/SidebarMenu";
import PassphraseModal from "./components/PassphraseModal";
import ContextSwitcher from "./components/ContextSwitcher";

// Lazy — page-level views only
const StatBars = lazy(() => import("./components/StatBars"));
const RecurringList = lazy(() => import("./components/RecurringList"));
const LoginScreen = lazy(() => import("./components/LoginScreen"));
const PartnershipView = lazy(() => import("./components/PartnershipView"));

export default function App() {
  const [token, setToken] = createSignal(localStorage.getItem("token"));
  const [passphrase, setPassphrase] = createSignal<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = createSignal(false);
  const [editingTx, setEditingTx] = createSignal<Transaction | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);
  const [activeView, setActiveView] = createSignal<
    "home" | "analytics" | "recurring" | "partnerships"
  >("home");
  const [activePartnershipId, setActivePartnershipId] = createSignal<
    string | null
  >(null);
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
    setActivePartnershipId(null);
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
          <BalanceHeader
            onMenuOpen={() => setIsSidebarOpen(true)}
            activePartnershipId={activePartnershipId()}
          />

          {/* Context switcher — shown for all views when in a partnership */}
          <ContextSwitcher
            activePartnershipId={activePartnershipId()}
            onChange={setActivePartnershipId}
          />

          <Show when={activeView() === "home"}>
            <AccountStrip activePartnershipId={activePartnershipId()} />
            <RecentList
              activePartnershipId={activePartnershipId()}
              onEdit={(tx) => {
                setEditingTx(tx);
                setIsSheetOpen(true);
              }}
            />
          </Show>

          <Show when={activeView() === "analytics"}>
            <StatBars activePartnershipId={activePartnershipId()} />
          </Show>

          <Show when={activeView() === "recurring"}>
            <RecurringList />
          </Show>

          <Show when={activeView() === "partnerships"}>
            <PartnershipView />
          </Show>

          {/* FAB — hidden on partnerships view */}
          <Show when={activeView() !== "partnerships"}>
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
          </Show>

          {/* Transaction sheet */}
          <Show when={isSheetOpen()}>
            <TransactionSheet
              editTransaction={editingTx() ?? undefined}
              activePartnershipId={activePartnershipId()}
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
