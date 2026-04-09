import { createSignal, For, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import {
  fetchAnalytics,
  fetchBudgets,
  fetchMe,
  fetchPartnerships,
  type AnalyticsPeriod,
  type BudgetProgress,
} from "../lib/api";
import { clsx as cn } from "clsx";

type Breakdown = "category" | "account";

const CATEGORY_COLORS = [
  "bg-purple-500",
  "bg-blue-400",
  "bg-pink-500",
  "bg-indigo-400",
  "bg-cyan-400",
];

const ACCOUNT_COLORS = [
  "bg-emerald-500",
  "bg-amber-400",
  "bg-rose-500",
  "bg-teal-400",
  "bg-orange-400",
];

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "30d", label: "30 Days" },
  { value: "month", label: "This Month" },
  { value: "ytd", label: "Year" },
  { value: "lastyear", label: "Last Year" },
];

const fmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    n,
  );

type Props = {
  activePartnershipId: string | null;
};

export default function StatBars(props: Props) {
  const [period, setPeriod] = createSignal<AnalyticsPeriod>("30d");
  const [breakdown, setBreakdown] = createSignal<Breakdown>("category");
  const [filterUserId, setFilterUserId] = createSignal<string | null>(null);

  const meQuery = createQuery(() => ({
    queryKey: ["me"],
    queryFn: fetchMe,
  }));

  const partnershipsQuery = createQuery(() => ({
    queryKey: ["partnerships"],
    queryFn: fetchPartnerships,
    enabled: props.activePartnershipId !== null,
  }));

  const activePartnership = () =>
    partnershipsQuery.data?.find((p) => p.id === props.activePartnershipId);

  const myId = () => meQuery.data?.id ?? "";

  // Partner members (not self) in the active partnership
  const partnerMembers = () =>
    activePartnership()?.members.filter(
      (m) => m.user_id !== myId() && m.status === "active",
    ) ?? [];

  const budgetsQuery = createQuery(() => ({
    queryKey: ["budgets", props.activePartnershipId],
    queryFn: () => fetchBudgets(props.activePartnershipId ?? undefined),
  }));

  // Map analytics period to a matching whole-balance budget
  const matchingBudget = (): BudgetProgress | undefined => {
    const budgets = budgetsQuery.data ?? [];
    if (period() === "month") return budgets.find((b) => !b.account_id && b.period_type === "month");
    if (period() === "ytd") return budgets.find((b) => !b.account_id && b.period_type === "year");
    return undefined;
  };

  const categoryBudget = (categoryName: string): BudgetProgress | undefined => {
    const mb = matchingBudget();
    if (!mb) return undefined;
    return mb.categories?.find((c) => c.category_name === categoryName) as unknown as BudgetProgress | undefined;
  };

  const analyticsQuery = createQuery(() => ({
    queryKey: [
      "analytics",
      period(),
      props.activePartnershipId,
      filterUserId(),
    ],
    queryFn: () =>
      fetchAnalytics(period(), props.activePartnershipId, filterUserId()),
  }));

  const data = () => analyticsQuery.data;
  const hasItems = () =>
    breakdown() === "category"
      ? (data()?.by_category?.length ?? 0) > 0
      : (data()?.by_account?.length ?? 0) > 0;

  const bar = (pct: number, colorSet: string[], i: number) => (
    <div class="h-1.5 bg-surface-hover rounded-full overflow-hidden">
      <div
        class={cn(
          "h-full rounded-full motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out",
          colorSet[i % colorSet.length],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );

  return (
    <section aria-label="Spending analytics" class="px-6 py-2">
      {/* Period tabs */}
      <div class="flex gap-2 mb-4 overflow-x-auto scrollbar-none">
        <For each={PERIODS}>
          {(p) => (
            <button
              type="button"
              onClick={() => setPeriod(p.value)}
              class={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                period() === p.value
                  ? "bg-purple-600/20 text-purple-400 ring-1 ring-purple-500/30"
                  : "bg-surface text-fg-2 hover:bg-surface-hover hover:text-fg",
              )}
            >
              {p.label}
            </button>
          )}
        </For>
      </div>

      {/* Person filter chips — only shown in partnership context */}
      <Show when={props.activePartnershipId !== null}>
        <div class="flex gap-2 mb-4 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterUserId(null)}
            class={cn(
              "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
              filterUserId() === null
                ? "bg-surface-active text-fg"
                : "text-fg-3 hover:text-fg-2",
            )}
          >
            Combined
          </button>
          <button
            type="button"
            onClick={() => setFilterUserId(myId())}
            class={cn(
              "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
              filterUserId() === myId()
                ? "bg-surface-active text-fg"
                : "text-fg-3 hover:text-fg-2",
            )}
          >
            Me
          </button>
          <For each={partnerMembers()}>
            {(m) => (
              <button
                type="button"
                onClick={() => setFilterUserId(m.user_id)}
                class={cn(
                  "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  filterUserId() === m.user_id
                    ? "bg-pink-500/20 text-pink-300"
                    : "text-fg-3 hover:text-pink-300",
                )}
              >
                {m.name}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Breakdown select */}
      <select
        value={breakdown()}
        onChange={(e) => setBreakdown(e.currentTarget.value as Breakdown)}
        class="w-full bg-surface rounded-xl px-4 py-3 text-fg text-sm outline-none focus:ring-1 focus:ring-purple-500 mb-6 cursor-pointer"
      >
        <option value="category">By Category</option>
        <option value="account">By Account</option>
      </select>

      <Show
        when={hasItems()}
        fallback={
          <div class="text-center py-16 px-6">
            <p class="text-fg font-medium mb-1">No expenses</p>
            <p class="text-fg-3 text-sm">for this period</p>
          </div>
        }
      >
        {/* Total */}
        <div class="mb-8">
          <p class="text-fg-3 text-xs uppercase tracking-wider mb-1">
            Total Spent
          </p>
          <p class="text-fg text-2xl font-semibold tabular-nums">
            {fmt(data()?.total ?? 0)}
          </p>
          <Show when={matchingBudget()}>
            {(budget) => (
              <div class="mt-2">
                <div class="flex justify-between text-xs mb-1">
                  <span class="text-fg-3">{budget().name}</span>
                  <span
                    class={cn(
                      "tabular-nums font-medium",
                      budget().percentage >= 100
                        ? "text-pink-400"
                        : budget().percentage >= 80
                          ? "text-amber-400"
                          : "text-fg-3",
                    )}
                  >
                    {fmt(budget().spent)} / {fmt(budget().amount)}
                  </span>
                </div>
                <div class="h-1 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    class={cn(
                      "h-full rounded-full motion-safe:transition-all motion-safe:duration-700",
                      budget().percentage >= 100
                        ? "bg-pink-500"
                        : budget().percentage >= 80
                          ? "bg-amber-400"
                          : "bg-purple-500",
                    )}
                    style={{ width: `${Math.min(budget().percentage, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </Show>
        </div>

        {/* By Category */}
        <Show when={breakdown() === "category"}>
          <ul class="space-y-5">
            <For each={data()?.by_category}>
              {(stat, i) => (
                <li>
                  <div class="flex justify-between items-baseline mb-2">
                    <span class="text-fg text-sm font-medium">
                      {stat.icon ? stat.icon + " " : ""}
                      {stat.category}
                    </span>
                    <span
                      class={cn(
                        "text-sm tabular-nums",
                        (() => {
                          const cb = categoryBudget(stat.category);
                          if (!cb) return "text-fg-2";
                          const pct = cb.amount > 0 ? (stat.amount / cb.amount) * 100 : 0;
                          return pct >= 100 ? "text-pink-400" : pct >= 80 ? "text-amber-400" : "text-fg-2";
                        })()
                      )}
                    >
                      {fmt(stat.amount)}
                      <Show when={categoryBudget(stat.category)}>
                        {(cb) => <span class="text-fg-4"> / {fmt(cb().amount)}</span>}
                      </Show>
                    </span>
                  </div>
                  {bar(stat.percentage, CATEGORY_COLORS, i())}
                  <p class="text-right text-xs text-fg-4 mt-1 tabular-nums">
                    {stat.percentage.toFixed(1)}%
                  </p>
                </li>
              )}
            </For>
          </ul>
        </Show>

        {/* By Account */}
        <Show when={breakdown() === "account"}>
          <ul class="space-y-5">
            <For each={data()?.by_account}>
              {(stat, i) => (
                <li>
                  <div class="flex justify-between items-baseline mb-2">
                    <span class="text-fg text-sm font-medium">
                      {stat.account_name}
                    </span>
                    <span class="text-fg-2 text-sm tabular-nums">
                      {fmt(stat.amount)}
                    </span>
                  </div>
                  {bar(stat.percentage, ACCOUNT_COLORS, i())}
                  <p class="text-right text-xs text-fg-4 mt-1 tabular-nums">
                    {stat.percentage.toFixed(1)}%
                  </p>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
    </section>
  );
}
