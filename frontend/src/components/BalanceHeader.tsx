import { Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { clsx as cn } from "clsx";
import {
  fetchAllTransactions,
  fetchAccounts,
  fetchBudgets,
  fetchMe,
  fetchPartnerships,
} from "../lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    n,
  );

const fmtBalance = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(n);
  }
  return fmt(n);
};

type BalanceHeaderProps = {
  onMenuOpen: () => void;
  onHomeClick: () => void;
  onBudgetClick?: () => void;
  activePartnershipId: string | null;
};

export default function BalanceHeader(props: BalanceHeaderProps) {
  const meQuery = createQuery(() => ({
    queryKey: ["me"],
    queryFn: fetchMe,
  }));
  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts", props.activePartnershipId],
    queryFn: () => fetchAccounts(props.activePartnershipId),
  }));
  const transactionsQuery = createQuery(() => ({
    queryKey: ["transactions-summary", props.activePartnershipId],
    queryFn: () => fetchAllTransactions(props.activePartnershipId),
  }));
  const budgetsQuery = createQuery(() => ({
    queryKey: ["budgets", props.activePartnershipId],
    queryFn: () => fetchBudgets(props.activePartnershipId),
  }));

  // Primary budget: whole-balance monthly budget (account_id empty, period_type month)
  const primaryBudget = () =>
    (budgetsQuery.data ?? []).find(
      (b) => !b.account_id && b.period_type === "month",
    );

  const partnershipsQuery = createQuery(() => ({
    queryKey: ["partnerships"],
    queryFn: fetchPartnerships,
    enabled: props.activePartnershipId !== null,
  }));

  const accounts = () => accountsQuery.data ?? [];
  const transactions = () => transactionsQuery.data ?? [];

  // Credit accounts track debt separately — exclude from spendable balance
  const creditAccountIds = () =>
    new Set(
      accounts()
        .filter((a) => a.type === "credit")
        .map((a) => a.id),
    );

  const balance = () =>
    accounts()
      .filter((a) => a.type !== "credit")
      .reduce((sum, a) => sum + a.balance, 0);

  const income = () =>
    transactions()
      .filter((t) => t.type === "income" && t.status !== "pending")
      .reduce((sum, t) => sum + t.amount, 0);

  const expenses = () =>
    transactions()
      .filter(
        (t) =>
          t.type === "expense" &&
          t.status !== "pending" &&
          // Exclude credit card payments (they reduce debt, not spending)
          !(t.to_account_id && creditAccountIds().has(t.to_account_id)),
      )
      .reduce((sum, t) => sum + t.amount, 0);

  const balanceLabel = () => {
    if (!props.activePartnershipId) return "Total Balance";
    const p = partnershipsQuery.data?.find(
      (x) => x.id === props.activePartnershipId,
    );
    if (p?.type === "couple") return "Combined Balance";
    return "Group Balance";
  };

  return (
    <header aria-label="Balance summary" class="px-6 pt-4 pb-6 text-center">
      <div class="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={props.onHomeClick}
          class="text-sm text-fg-2 transition-colors hover:text-fg"
          aria-label="Go to home"
        >
          Hi,{" "}
          <span class="text-fg font-medium">{meQuery.data?.name ?? ""}</span>
        </button>
        <button
          type="button"
          onClick={props.onMenuOpen}
          class="p-1.5 -mr-1.5 text-fg-2 hover:text-fg transition-colors"
          aria-label="Open menu"
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
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>
      <p class="text-xs font-medium tracking-widest text-fg-3 uppercase mb-3">
        {balanceLabel()}
      </p>
      <div
        class="font-bold text-fg mb-4 tabular-nums transition-all"
        classList={{
          "text-5xl": Math.abs(balance()) < 1_000_000,
          "text-4xl":
            Math.abs(balance()) >= 1_000_000 &&
            Math.abs(balance()) < 1_000_000_000,
          "text-3xl": Math.abs(balance()) >= 1_000_000_000,
        }}
      >
        {fmtBalance(balance())}
      </div>
      {/* Budget progress bar — only shown when a whole-balance monthly budget exists */}
      <Show when={primaryBudget()}>
        {(bp) => {
          const pct = Math.min(bp().percentage, 100);
          const barColor =
            bp().percentage >= 100
              ? "bg-pink-500"
              : bp().percentage >= 80
                ? "bg-amber-400"
                : "bg-purple-500";
          const fmtShort = (n: number) =>
            new Intl.NumberFormat("en-PH", {
              style: "currency",
              currency: "PHP",
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(n);
          return (
            <button
              type="button"
              onClick={() => props.onBudgetClick?.()}
              class="w-full mb-4 px-2 group"
              aria-label="View monthly budget progress"
            >
              <div class="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  class={cn(
                    "h-full rounded-full transition-all duration-700 motion-reduce:transition-none",
                    barColor,
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div class="flex justify-between items-center mt-1">
                <span class="text-xs text-fg-3">{bp().name}</span>
                <span
                  class={cn(
                    "text-xs",
                    bp().percentage >= 100
                      ? "text-pink-400"
                      : bp().percentage >= 80
                        ? "text-amber-400"
                        : "text-fg-3",
                  )}
                >
                  {fmtShort(bp().spent)} / {fmtShort(bp().amount)}
                </span>
              </div>
            </button>
          );
        }}
      </Show>
      <div class="flex justify-center gap-6 text-sm">
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-amount-income inline-block" />
          <span class="text-fg-2">
            <span class="text-amount-income font-medium">{fmt(income())}</span>{" "}
            in
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-amount-expense inline-block" />
          <span class="text-fg-2">
            <span class="text-amount-expense font-medium">
              {fmt(expenses())}
            </span>{" "}
            out
          </span>
        </div>
      </div>
    </header>
  );
}
