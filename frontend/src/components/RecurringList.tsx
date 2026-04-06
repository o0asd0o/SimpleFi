import { createSignal, For, Show } from "solid-js";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import {
  deleteRecurringRule,
  fetchRecurringRules,
  fetchAccounts,
  fetchCategories,
  type RecurringRule,
} from "../lib/api";
import { cn } from "../lib/cn";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

function formatFrequency(f: string): string {
  switch (f) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Every 2 weeks";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    default:
      return f;
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RecurringList() {
  const [openId, setOpenId] = createSignal<string | null>(null);
  const queryClient = useQueryClient();

  const rulesQuery = createQuery(() => ({
    queryKey: ["recurring-rules"],
    queryFn: fetchRecurringRules,
  }));

  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  }));

  const categoriesQuery = createQuery(() => ({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  }));

  const rules = () => rulesQuery.data ?? [];
  const accountName = (id: string) =>
    (accountsQuery.data ?? []).find((a) => a.id === id)?.name ?? "";
  const categoryIcon = (id: string) =>
    (categoriesQuery.data ?? []).find((c) => c.id === id)?.icon ?? "";
  const categoryName = (id: string) =>
    (categoriesQuery.data ?? []).find((c) => c.id === id)?.name ?? "";

  const deleteMut = createMutation(() => ({
    mutationFn: deleteRecurringRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-rules"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-summary"] });
      setOpenId(null);
    },
  }));

  return (
    <section aria-label="Recurring payments" class="px-6 pt-4">
      <h2 class="text-lg font-bold text-white mb-4">Recurring Payments</h2>

      <Show
        when={rules().length > 0}
        fallback={
          <Show when={!rulesQuery.isLoading}>
            <div class="text-center py-20 px-6">
              <svg
                class="w-10 h-10 text-gray-600 mx-auto mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <p class="text-white font-medium mb-1">No recurring payments</p>
              <p class="text-gray-500 text-sm">
                Set up repeating transactions when adding expenses
              </p>
            </div>
          </Show>
        }
      >
        <ul class="space-y-2">
          <For each={rules()}>
            {(rule) => {
              let touchStartX = 0;
              let touchStartY = 0;

              const isOpen = () => openId() === rule.id;

              const handleTouchStart = (e: TouchEvent) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                if (openId() !== null && openId() !== rule.id) setOpenId(null);
              };

              const handleTouchEnd = (e: TouchEvent) => {
                const dx = e.changedTouches[0].clientX - touchStartX;
                const dy = e.changedTouches[0].clientY - touchStartY;
                if (Math.abs(dx) < Math.abs(dy)) return;
                if (dx < -40) setOpenId(rule.id);
                else if (dx > 20 && isOpen()) setOpenId(null);
              };

              return (
                <li class="overflow-hidden rounded-xl bg-white/5">
                  <div
                    class="flex transition-transform duration-200 ease-out"
                    style={{
                      transform: isOpen()
                        ? "translateX(-72px)"
                        : "translateX(0)",
                    }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => {
                      if (isOpen()) setOpenId(null);
                    }}
                  >
                    {/* Card content */}
                    <div class="w-full flex-shrink-0 p-4">
                      <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center gap-2 min-w-0">
                          <Show when={rule.category_id}>
                            <span class="text-base flex-shrink-0">
                              {categoryIcon(rule.category_id)}
                            </span>
                          </Show>
                          <span class="text-white font-medium text-sm truncate">
                            {rule.description ||
                              categoryName(rule.category_id) ||
                              rule.category ||
                              "Untitled"}
                          </span>
                        </div>
                        <span
                          class={cn(
                            "font-mono text-sm font-medium flex-shrink-0 ml-2",
                            rule.type === "expense"
                              ? "text-purple-400"
                              : rule.type === "transfer"
                                ? "text-cyan-400"
                                : "text-blue-400",
                          )}
                        >
                          {rule.type === "expense"
                            ? "-"
                            : rule.type === "income"
                              ? "+"
                              : ""}
                          ₱{fmt(rule.amount)}
                        </span>
                      </div>

                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span class="inline-flex items-center gap-1">
                          <span
                            class={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide",
                              "bg-purple-600/20 text-purple-400",
                            )}
                          >
                            {formatFrequency(rule.frequency)}
                          </span>
                        </span>
                        <Show when={accountName(rule.account_id)}>
                          <span>{accountName(rule.account_id)}</span>
                        </Show>
                        <Show
                          when={rule.type === "transfer" && rule.to_account_id}
                        >
                          <span>→ {accountName(rule.to_account_id!)}</span>
                        </Show>
                      </div>

                      <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Next: {formatDate(rule.next_due)}</span>
                        <span>
                          {rule.end_date
                            ? `Ends: ${formatDate(rule.end_date)}`
                            : "Indefinite"}
                        </span>
                      </div>
                    </div>

                    {/* Delete button — revealed on swipe */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMut.mutate(rule.id);
                      }}
                      disabled={deleteMut.isPending}
                      class="w-[72px] flex-shrink-0 bg-red-500 flex flex-col items-center justify-center gap-1 text-white disabled:opacity-60"
                      aria-label="Delete recurring rule"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      <span class="text-[10px] font-semibold uppercase tracking-wide">
                        Delete
                      </span>
                    </button>
                  </div>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>
    </section>
  );
}
