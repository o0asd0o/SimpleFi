import { createSignal, Show } from "solid-js";
import { useQueryClient } from "@tanstack/solid-query";
import { type AuthResponse, type Transaction } from "./lib/api";
import BalanceHeader from "./components/BalanceHeader";
import TransactionSheet from "./components/TransactionSheet";
import RecentList from "./components/RecentList";
import StatBars from "./components/StatBars";
import AccountStrip from "./components/AccountStrip";
import LoginScreen from "./components/LoginScreen";
import PassphraseModal from "./components/PassphraseModal";
import SidebarMenu from "./components/SidebarMenu";

export default function App() {
  const [token, setToken] = createSignal(localStorage.getItem("token"));
  const [passphrase, setPassphrase] = createSignal<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = createSignal(false);
  const [editingTx, setEditingTx] = createSignal<Transaction | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);
  const [activeView, setActiveView] = createSignal<"home" | "analytics">("home");
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
    <Show
      when={token()}
      fallback={<LoginScreen onAuthSuccess={handleAuthSuccess} />}
    >
      <div class="min-h-screen bg-app-bg text-white max-w-md mx-auto relative pb-28">
        <BalanceHeader onMenuOpen={() => setIsSidebarOpen(true)} />

        <Show when={activeView() === "home"}>
          <AccountStrip />
          <RecentList onEdit={(tx) => { setEditingTx(tx); setIsSheetOpen(true); }} />
        </Show>

        <Show when={activeView() === "analytics"}>
          <StatBars />
        </Show>

        {/* FAB */}
        <button
          type="button"
          aria-label="Add transaction"
          onClick={() => { setEditingTx(null); setIsSheetOpen(true); }}
          class="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 active:scale-95 text-white shadow-lg shadow-purple-900/50 flex items-center justify-center text-2xl font-light transition-all"
        >
          +
        </button>

        {/* Transaction sheet */}
        <Show when={isSheetOpen()}>
          <TransactionSheet
            editTransaction={editingTx() ?? undefined}
            onClose={() => { setIsSheetOpen(false); setEditingTx(null); }}
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
  );
}
