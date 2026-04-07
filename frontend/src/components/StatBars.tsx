import { createSignal, For, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import {
  fetchAnalytics,
  fetchMe,
  fetchPartnerships,
  type AnalyticsPeriod,
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
    <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
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
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white",
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
                ? "bg-white/15 text-white"
                : "text-gray-500 hover:text-gray-300",
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
                ? "bg-white/15 text-white"
                : "text-gray-500 hover:text-gray-300",
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
                    : "text-gray-500 hover:text-pink-300",
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
        class="w-full bg-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-purple-500 mb-6 cursor-pointer [&>option]:bg-[#1c1829] [&>option]:text-white"
      >
        <option value="category">By Category</option>
        <option value="account">By Account</option>
      </select>

      <Show
        when={hasItems()}
        fallback={
          <div class="text-center py-16 px-6">
            <p class="text-white font-medium mb-1">No expenses</p>
            <p class="text-gray-500 text-sm">for this period</p>
          </div>
        }
      >
        {/* Total */}
        <div class="mb-8">
          <p class="text-gray-500 text-xs uppercase tracking-wider mb-1">
            Total Spent
          </p>
          <p class="text-white text-2xl font-semibold tabular-nums">
            {fmt(data()?.total ?? 0)}
          </p>
        </div>

        {/* By Category */}
        <Show when={breakdown() === "category"}>
          <ul class="space-y-5">
            <For each={data()?.by_category}>
              {(stat, i) => (
                <li>
                  <div class="flex justify-between items-baseline mb-2">
                    <span class="text-white text-sm font-medium">
                      {stat.icon ? stat.icon + " " : ""}
                      {stat.category}
                    </span>
                    <span class="text-gray-400 text-sm tabular-nums">
                      {fmt(stat.amount)}
                    </span>
                  </div>
                  {bar(stat.percentage, CATEGORY_COLORS, i())}
                  <p class="text-right text-xs text-gray-600 mt-1 tabular-nums">
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
                    <span class="text-white text-sm font-medium">
                      {stat.account_name}
                    </span>
                    <span class="text-gray-400 text-sm tabular-nums">
                      {fmt(stat.amount)}
                    </span>
                  </div>
                  {bar(stat.percentage, ACCOUNT_COLORS, i())}
                  <p class="text-right text-xs text-gray-600 mt-1 tabular-nums">
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
