import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { clsx as cn } from "clsx";
import {
  createBudget,
  updateBudget,
  fetchAccounts,
  fetchCategories,
  type BudgetProgress,
  type CreateBudgetInput,
} from "../lib/api";
import { getScrollbarOffset, lockBodyScroll } from "../lib/scroll-lock";
import { createSwipeHandlers } from "../lib/swipe";

type PeriodType = "month" | "year" | "custom";

type CategoryRow = { category_id: string; amount: string };

type Props = {
  onClose: () => void;
  editBudget?: BudgetProgress;
  initialAccountId?: string;
  activePartnershipId: string | null;
};

const sanitizeAmount = (value: string): string => {
  const stripped = value.replace(/[^0-9.]/g, "");
  const [whole = "", ...rest] = stripped.split(".");
  return rest.length === 0 ? whole : `${whole}.${rest.join("")}`;
};

const formattedDisplay = (raw: string): string => {
  if (!raw) return "";
  const parts = raw.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
};

const FORM_OPTIONS = {
  staleTime: 60_000,
  refetchOnMount: false as const,
  refetchOnWindowFocus: false as const,
  refetchOnReconnect: false as const,
};

export default function BudgetSheet(props: Props) {
  const scrollbarOffset = getScrollbarOffset();
  const editing = () => props.editBudget;
  let unlockBodyScroll = () => {};
  let panelRef: HTMLDivElement | undefined;

  const [name, setName] = createSignal(editing()?.name ?? "");
  const [amount, setAmount] = createSignal(editing()?.amount?.toString() ?? "");
  const [periodType, setPeriodType] = createSignal<PeriodType>(
    editing()?.period_type ?? "month",
  );
  const [startDate, setStartDate] = createSignal(editing()?.start_date ?? "");
  const [endDate, setEndDate] = createSignal(editing()?.end_date ?? "");
  const [accountId, setAccountId] = createSignal(
    editing()?.account_id ?? props.initialAccountId ?? "",
  );
  const [categoryRows, setCategoryRows] = createSignal<CategoryRow[]>(
    editing()?.categories?.map((c) => ({
      category_id: c.category_id,
      amount: c.limit.toString(),
    })) ?? [],
  );

  const queryClient = useQueryClient();

  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts", props.activePartnershipId],
    queryFn: () => fetchAccounts(props.activePartnershipId),
    ...FORM_OPTIONS,
  }));

  const categoriesQuery = createQuery(() => ({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    ...FORM_OPTIONS,
  }));

  const expenseCategories = () =>
    (categoriesQuery.data ?? []).filter((c) => c.type === "expense");

  const isValid = () => {
    const a = parseFloat(amount());
    if (!amount() || isNaN(a) || a <= 0) return false;
    if (periodType() === "custom" && (!startDate() || !endDate())) return false;
    return true;
  };

  const saveMutation = createMutation(() => ({
    mutationFn: (data: CreateBudgetInput) =>
      editing() ? updateBudget(editing()!.id, data) : createBudget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      props.onClose();
    },
  }));

  const handleSubmit = () => {
    if (!isValid() || saveMutation.isPending) return;
    const input: CreateBudgetInput = {
      name:
        name().trim() ||
        (periodType() === "year"
          ? "Yearly Budget"
          : periodType() === "custom"
            ? "Custom Budget"
            : "Monthly Budget"),
      amount: parseFloat(amount()),
      period_type: periodType(),
      account_id: accountId() || undefined,
      start_date: periodType() === "custom" ? startDate() : undefined,
      end_date: periodType() === "custom" ? endDate() : undefined,
      categories: categoryRows()
        .filter((r) => r.category_id && r.amount && parseFloat(r.amount) > 0)
        .map((r) => ({
          category_id: r.category_id,
          amount: parseFloat(r.amount),
        })),
    };
    saveMutation.mutate(input);
  };

  const addCategoryRow = () => {
    setCategoryRows((rows) => [...rows, { category_id: "", amount: "" }]);
  };

  const removeCategoryRow = (index: number) => {
    setCategoryRows((rows) => rows.filter((_, i) => i !== index));
  };

  const updateCategoryRow = (
    index: number,
    field: keyof CategoryRow,
    value: string,
  ) => {
    setCategoryRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  };

  onMount(() => {
    unlockBodyScroll = lockBodyScroll();
    // Swipe down to close
    if (panelRef) {
      const handlers = createSwipeHandlers({ onSwipeDown: props.onClose });
      panelRef.addEventListener("touchstart", handlers.onTouchStart, {
        passive: true,
      });
      panelRef.addEventListener("touchmove", handlers.onTouchMove, {
        passive: true,
      });
      panelRef.addEventListener("touchend", handlers.onTouchEnd);
      onCleanup(() => {
        panelRef?.removeEventListener("touchstart", handlers.onTouchStart);
        panelRef?.removeEventListener("touchmove", handlers.onTouchMove);
        panelRef?.removeEventListener("touchend", handlers.onTouchEnd);
      });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  onCleanup(() => {
    unlockBodyScroll();
  });

  return (
    <>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-40 bg-overlay backdrop-blur-sm"
        onClick={props.onClose}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={editing() ? "Edit budget" : "New budget"}
        class="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg bg-sheet-bg rounded-t-2xl overflow-hidden sheet-enter"
        style={{ right: `${scrollbarOffset}px`, left: `${scrollbarOffset}px` }}
      >
        {/* Drag handle */}
        <div class="flex justify-center pt-3 pb-1">
          <div class="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div class="px-5 pb-2 pt-1 flex items-center justify-between">
          <h2 class="text-base font-semibold text-fg">
            {editing() ? "Edit Budget" : "New Budget"}
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            class="p-1.5 rounded-lg text-fg-3 hover:text-fg hover:bg-white/5 transition-colors"
            aria-label="Close"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="overflow-y-auto max-h-[75dvh] px-5 pb-8 space-y-5">
          {/* Budget Name */}
          <div class="space-y-1.5">
            <label class="text-xs text-fg-3 uppercase tracking-wider">
              Name
            </label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Monthly Budget"
              maxLength={100}
              class="w-full bg-surface text-fg placeholder-fg-3 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Amount */}
          <div class="space-y-1.5">
            <label class="text-xs text-fg-3 uppercase tracking-wider">
              Spending Limit
            </label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-fg-3 text-sm">
                ₱
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={formattedDisplay(amount())}
                onInput={(e) =>
                  setAmount(sanitizeAmount(e.currentTarget.value))
                }
                onKeyDown={(e) => {
                  if (e.ctrlKey || e.metaKey || e.altKey) return;
                  const allowed = new Set([
                    "Backspace",
                    "Delete",
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End",
                    "Tab",
                    "Enter",
                    "Escape",
                  ]);
                  if (allowed.has(e.key) || /^[0-9]$/.test(e.key)) return;
                  if (e.key === "." && !amount().includes(".")) return;
                  e.preventDefault();
                }}
                placeholder="0"
                class="w-full bg-surface text-fg placeholder-fg-3 rounded-xl px-4 py-3 pl-8 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>

          {/* Scope */}
          <div class="space-y-1.5">
            <label class="text-xs text-fg-3 uppercase tracking-wider">
              Scope
            </label>
            <select
              value={accountId()}
              onChange={(e) => setAccountId(e.currentTarget.value)}
              class="w-full bg-surface text-fg rounded-xl px-4 py-3 min-h-[44px] text-sm outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none"
            >
              <option value="">All Accounts</option>
              <For each={accountsQuery.data ?? []}>
                {(a) => (
                  <option value={a.id}>
                    {a.name} ({a.type})
                  </option>
                )}
              </For>
            </select>
          </div>

          {/* Duration */}
          <div class="space-y-1.5">
            <label class="text-xs text-fg-3 uppercase tracking-wider">
              Duration
            </label>
            <div class="flex gap-2">
              {(["month", "year", "custom"] as const).map((p) => (
                <button
                  type="button"
                  onClick={() => setPeriodType(p)}
                  class={cn(
                    "flex-1 py-2 rounded-xl text-sm font-medium transition-colors",
                    periodType() === p
                      ? "bg-purple-600 text-white"
                      : "bg-surface text-fg-2 hover:text-fg",
                  )}
                >
                  {p === "month"
                    ? "This Month"
                    : p === "year"
                      ? "This Year"
                      : "Custom"}
                </button>
              ))}
            </div>

            <Show when={periodType() === "custom"}>
              <div class="flex gap-3 pt-1">
                <div class="flex-1 space-y-1">
                  <label class="text-xs text-fg-3">Start Date</label>
                  <input
                    type="date"
                    value={startDate()}
                    onInput={(e) => setStartDate(e.currentTarget.value)}
                    class="w-full bg-surface text-fg rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div class="flex-1 space-y-1">
                  <label class="text-xs text-fg-3">End Date</label>
                  <input
                    type="date"
                    value={endDate()}
                    min={startDate()}
                    onInput={(e) => setEndDate(e.currentTarget.value)}
                    class="w-full bg-surface text-fg rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>
            </Show>
          </div>

          {/* Category limits */}
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs text-fg-3 uppercase tracking-wider">
                Category Limits
              </label>
              <span class="text-xs text-fg-3">(optional)</span>
            </div>

            <Show when={categoryRows().length > 0}>
              <div class="space-y-2">
                <For each={categoryRows()}>
                  {(row, i) => (
                    <div class="flex gap-2 items-center">
                      <select
                        value={row.category_id}
                        onChange={(e) =>
                          updateCategoryRow(
                            i(),
                            "category_id",
                            e.currentTarget.value,
                          )
                        }
                        class="flex-1 bg-surface text-fg rounded-xl px-3 py-2.5 min-h-[44px] text-sm outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none"
                      >
                        <option value="">Pick category</option>
                        <For each={expenseCategories()}>
                          {(c) => (
                            <option value={c.id}>
                              {c.icon} {c.name}
                            </option>
                          )}
                        </For>
                      </select>
                      <div class="relative w-28">
                        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-3 text-xs">
                          ₱
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formattedDisplay(row.amount)}
                          onInput={(e) =>
                            updateCategoryRow(
                              i(),
                              "amount",
                              sanitizeAmount(e.currentTarget.value),
                            )
                          }
                          placeholder="0"
                          class="w-full bg-surface text-fg placeholder-fg-3 rounded-xl px-3 py-2.5 pl-6 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCategoryRow(i())}
                        class="p-1.5 rounded-lg text-fg-3 hover:text-pink-400 hover:bg-white/5 transition-colors flex-shrink-0"
                        aria-label="Remove category limit"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <button
              type="button"
              onClick={addCategoryRow}
              class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/15 text-fg-3 text-sm hover:border-purple-500/50 hover:text-purple-400 transition-colors"
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
              Add category limit
            </button>
          </div>

          {/* Save button */}
          <button
            type="button"
            disabled={!isValid() || saveMutation.isPending}
            onClick={handleSubmit}
            class={cn(
              "w-full py-4 rounded-2xl text-base font-semibold transition-all",
              isValid() && !saveMutation.isPending
                ? "bg-purple-600 text-white hover:bg-purple-700 active:scale-[0.98]"
                : "bg-surface text-fg-3 cursor-not-allowed",
            )}
          >
            {saveMutation.isPending
              ? "Saving…"
              : editing()
                ? "Save Changes"
                : "Create Budget"}
          </button>
        </div>
      </div>
    </>
  );
}
