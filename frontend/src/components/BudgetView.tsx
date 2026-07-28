import { createSignal, For, Show } from "solid-js";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { clsx as cn } from "clsx";
import {
  deleteBudget,
  fetchBudgets,
  fetchAccounts,
  type BudgetProgress,
} from "../lib/api";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

function periodLabel(bp: BudgetProgress): string {
  if (bp.period_type === "custom") {
    const fmt = (s: string) => {
      const d = new Date(s + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };
    return `${fmt(bp.start_date ?? "")} – ${fmt(bp.end_date ?? "")}`;
  }
  if (bp.period_type === "year") {
    return new Date().getFullYear().toString();
  }
  // month
  return new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function progressBarColor(pct: number): string {
  if (pct >= 100) return "bg-pink-500";
  if (pct >= 80) return "bg-amber-400";
  return "bg-purple-500";
}

type Props = {
  activePartnershipId: string | null;
  onAddBudget: () => void;
  onEditBudget: (bp: BudgetProgress) => void;
};

export default function BudgetView(props: Props) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = createSignal<string | null>(null);

  const budgetsQuery = createQuery(() => ({
    queryKey: ["budgets", props.activePartnershipId],
    queryFn: () => fetchBudgets(props.activePartnershipId),
  }));

  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts", props.activePartnershipId],
    queryFn: () => fetchAccounts(props.activePartnershipId),
  }));

  const accountMap = () => {
    const map = new Map<string, string>();
    (accountsQuery.data ?? []).forEach((a) => map.set(a.id, a.name));
    return map;
  };

  const deleteMutation = createMutation(() => ({
    mutationFn: deleteBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  }));

  return (
    <div class="flex-1 overflow-y-auto px-4 pb-8">
      {/* Header */}
      <div class="flex items-center justify-between py-4">
        <h2 class="text-lg font-bold text-fg">Budgets</h2>
        <button
          type="button"
          onClick={props.onAddBudget}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-700 dark:text-purple-400 text-sm font-medium hover:bg-purple-600/30 transition-colors"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Budget
        </button>
      </div>

      {/* Loading */}
      <Show when={budgetsQuery.isPending}>
        <div class="flex justify-center py-12">
          <div class="w-6 h-6 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
        </div>
      </Show>

      {/* Empty state */}
      <Show
        when={!budgetsQuery.isPending && (budgetsQuery.data?.length ?? 0) === 0}
      >
        <div class="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div class="text-4xl">🎯</div>
          <p class="text-fg font-medium">No budgets yet</p>
          <p class="text-fg-2 text-sm max-w-60">
            Set a spending limit to stay on track with your finances.
          </p>
          <button
            type="button"
            onClick={props.onAddBudget}
            class="mt-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            Create your first budget
          </button>
        </div>
      </Show>

      {/* Budget cards */}
      <Show when={(budgetsQuery.data?.length ?? 0) > 0}>
        <div class="space-y-3">
          <For each={budgetsQuery.data}>
            {(bp) => {
              const isExpanded = () => expandedId() === bp.id;
              const pct = Math.min(bp.percentage, 100);
              const barColor = progressBarColor(bp.percentage);

              return (
                <div class="bg-surface rounded-2xl p-4 space-y-3">
                  {/* Card header */}
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="text-fg font-semibold truncate">{bp.name}</p>
                      <p class="text-fg-3 text-xs mt-0.5">
                        {periodLabel(bp)}
                        {" · "}
                        {bp.account_id
                          ? (accountMap().get(bp.account_id) ??
                            "Unknown Account")
                          : "All Accounts"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => props.onEditBudget(bp)}
                      class="flex-shrink-0 p-1.5 rounded-lg text-fg-3 hover:text-fg hover:bg-white/5 transition-colors"
                      aria-label="Edit budget"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div class="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        class={cn(
                          "h-full rounded-full transition-all duration-500 motion-reduce:transition-none",
                          barColor,
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div class="flex justify-between items-center mt-1.5">
                      <span class="text-xs text-fg-2">
                        {fmtCurrency(bp.spent)} spent
                      </span>
                      <span
                        class={cn(
                          "text-xs font-medium",
                          bp.percentage >= 100
                            ? "text-pink-400"
                            : bp.percentage >= 80
                              ? "text-amber-400"
                              : "text-fg-2",
                        )}
                      >
                        {bp.percentage.toFixed(0)}% of {fmtCurrency(bp.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Category sub-budgets toggle */}
                  <Show when={bp.categories.length > 0}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded() ? null : bp.id)}
                      class="w-full flex items-center justify-between text-xs text-fg-3 hover:text-fg-2 transition-colors pt-1 border-t border-dim"
                    >
                      <span>
                        {bp.categories.length} category limit
                        {bp.categories.length !== 1 ? "s" : ""}
                      </span>
                      <svg
                        class={cn(
                          "w-4 h-4 transition-transform",
                          isExpanded() ? "rotate-180" : "",
                        )}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    <Show when={isExpanded()}>
                      <div class="space-y-2 pt-1">
                        <For each={bp.categories}>
                          {(cat) => {
                            const catPct = Math.min(cat.percentage, 100);
                            const catColor = progressBarColor(cat.percentage);
                            return (
                              <div class="space-y-1">
                                <div class="flex justify-between text-xs">
                                  <span class="text-fg-2">
                                    {cat.icon} {cat.category_name}
                                  </span>
                                  <span
                                    class={cn(
                                      cat.percentage >= 100
                                        ? "text-pink-400"
                                        : cat.percentage >= 80
                                          ? "text-amber-400"
                                          : "text-fg-3",
                                    )}
                                  >
                                    {fmtCurrency(cat.spent)} /{" "}
                                    {fmtCurrency(cat.limit)}
                                  </span>
                                </div>
                                <div class="h-1 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    class={cn(
                                      "h-full rounded-full transition-all duration-500 motion-reduce:transition-none",
                                      catColor,
                                    )}
                                    style={{ width: `${catPct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
