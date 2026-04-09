import { createSignal, lazy, onMount, Show, Suspense } from "solid-js";
import { useQueryClient } from "@tanstack/solid-query";
import { type AuthResponse, type BudgetProgress, type Transaction } from "./lib/api";
import { createThemeSignal, type ThemeMode } from "./lib/theme";
import { setSheetOpen } from "./lib/sw-update";

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
const BudgetView = lazy(() => import("./components/BudgetView"));
const BudgetSheet = lazy(() => import("./components/BudgetSheet"));

export default function App() {
  const [theme, setTheme] = createThemeSignal();
  const [showUpdateToast, setShowUpdateToast] = createSignal(false);
  const [token, setToken] = createSignal(localStorage.getItem("token"));
  const [passphrase, setPassphrase] = createSignal<string | null>(null);
  const [isSheetOpen, setIsSheetOpenRaw] = createSignal(false);
  const setIsSheetOpen = (v: boolean) => {
    setIsSheetOpenRaw(v);
    setSheetOpen(v);
  };
  const [editingTx, setEditingTx] = createSignal<Transaction | null>(null);
  const [creditPayTarget, setCreditPayTarget] = createSignal<string | null>(
    null,
  );
  const [incomeAccountTarget, setIncomeAccountTarget] = createSignal<
    string | null
  >(null);
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);
  const [activeView, setActiveView] = createSignal<
    "home" | "analytics" | "budgets" | "recurring" | "partnerships"
  >("home");
  const [isBudgetSheetOpen, setIsBudgetSheetOpen] = createSignal(false);
  const [editingBudget, setEditingBudget] = createSignal<BudgetProgress | null>(null);
  const [activePartnershipId, setActivePartnershipId] = createSignal<
    string | null
  >(null);
  const queryClient = useQueryClient();

  // Post-update toast
  onMount(() => {
    if (sessionStorage.getItem("simplfi-updated")) {
      sessionStorage.removeItem("simplfi-updated");
      setShowUpdateToast(true);
      setTimeout(() => setShowUpdateToast(false), 3000);
    }
  });

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
        <div class="min-h-screen bg-app-bg text-fg max-w-md mx-auto relative pb-28">
          <BalanceHeader
            onMenuOpen={() => setIsSidebarOpen(true)}
            onHomeClick={() => setActiveView("home")}
            activePartnershipId={activePartnershipId()}
            onBudgetClick={() => setActiveView("budgets")}
          />

          {/* Context switcher — shown for all views when in a partnership */}
          <ContextSwitcher
            activePartnershipId={activePartnershipId()}
            onChange={setActivePartnershipId}
          />

          <Show when={activeView() === "home"}>
            <AccountStrip
              activePartnershipId={activePartnershipId()}
              onPayCredit={(id) => {
                setEditingTx(null);
                setIncomeAccountTarget(null);
                setCreditPayTarget(id);
                setIsSheetOpen(true);
              }}
              onAccountTap={(id) => {
                setEditingTx(null);
                setCreditPayTarget(null);
                setIncomeAccountTarget(id);
                setIsSheetOpen(true);
              }}
            />
            <RecentList
              activePartnershipId={activePartnershipId()}
              onEdit={(tx) => {
                setEditingTx(tx);
                setIsSheetOpen(true);
              }}
              onPayCredit={(id) => {
                setEditingTx(null);
                setCreditPayTarget(id);
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

          <Show when={activeView() === "budgets"}>
            <BudgetView
              activePartnershipId={activePartnershipId()}
              onAddBudget={() => {
                setEditingBudget(null);
                setIsBudgetSheetOpen(true);
              }}
              onEditBudget={(bp) => {
                setEditingBudget(bp);
                setIsBudgetSheetOpen(true);
              }}
            />
          </Show>

          {/* FAB — hidden on partnerships and budgets views */}
          <Show when={activeView() !== "partnerships" && activeView() !== "budgets"}>
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

          {/* Budget sheet */}
          <Show when={isBudgetSheetOpen()}>
            <BudgetSheet
              onClose={() => {
                setIsBudgetSheetOpen(false);
                setEditingBudget(null);
              }}
              editBudget={editingBudget() ?? undefined}
              activePartnershipId={activePartnershipId()}
            />
          </Show>

          {/* Transaction sheet */}
          <Show when={isSheetOpen()}>
            <TransactionSheet
              editTransaction={editingTx() ?? undefined}
              activePartnershipId={activePartnershipId()}
              initialMode={
                creditPayTarget()
                  ? "transfer"
                  : incomeAccountTarget()
                    ? "income"
                    : undefined
              }
              initialAccountId={incomeAccountTarget() ?? undefined}
              initialToAccountId={creditPayTarget() ?? undefined}
              onClose={() => {
                setIsSheetOpen(false);
                setEditingTx(null);
                setCreditPayTarget(null);
                setIncomeAccountTarget(null);
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
              theme={theme()}
              onThemeChange={(t: ThemeMode) => setTheme(t)}
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

        {/* Update toast */}
        <Show when={showUpdateToast()}>
          <div class="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-purple-600/90 text-white text-sm font-medium shadow-lg backdrop-blur-sm z-50">
            App updated
          </div>
        </Show>
      </Show>
    </Suspense>
  );
}
