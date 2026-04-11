import { For, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { fetchAccounts, fetchCategories } from "../lib/api";
import { clsx as cn } from "clsx";

type SortDir = "desc" | "asc";
type ActiveDropdown = "account" | "category" | null;
type FilterMode = "income" | "expense" | "transfer" | null;

type Props = {
  activePartnershipId: string | null;
  filterAccountId: string | null;
  filterCategoryId: string | null;
  filterMode: FilterMode;
  sortDir: SortDir;
  activeDropdown: ActiveDropdown;
  onAccountFilter: (id: string | null) => void;
  onCategoryFilter: (id: string | null) => void;
  onModeFilter: (mode: FilterMode) => void;
  onSortToggle: () => void;
  onDropdownToggle: (d: "account" | "category") => void;
  onDropdownClose: () => void;
  onClearFilters: () => void;
};

export default function TransactionFilters(props: Props) {
  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts", props.activePartnershipId],
    queryFn: () => fetchAccounts(props.activePartnershipId),
  }));
  const categoriesQuery = createQuery(() => ({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  }));

  const categoryIcon = (id: string) =>
    (categoriesQuery.data ?? []).find((c) => c.id === id)?.icon ?? "";
  const categoryName = (id: string) =>
    (categoriesQuery.data ?? []).find((c) => c.id === id)?.name ?? "";
  const accountName = (id: string) =>
    (accountsQuery.data ?? []).find((a) => a.id === id)?.name ?? "";

  return (
    <div class="flex flex-col border-b border-dim">
      {/* Mode filter pills */}
      <div class="flex items-center gap-1.5 px-4 pt-2 pb-1.5">
        {(
          [
            { value: null, label: "All" },
            { value: "expense", label: "Spent" },
            { value: "income", label: "Earned" },
            { value: "transfer", label: "Transfer" },
          ] as { value: FilterMode; label: string }[]
        ).map((opt) => (
          <button
            type="button"
            onClick={() => props.onModeFilter(opt.value)}
            class={cn(
              "px-3 py-0.5 rounded-full text-xs font-medium transition-colors",
              props.filterMode === opt.value
                ? "bg-purple-600 text-white"
                : "bg-surface-hover text-fg-3 hover:text-fg",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Account / category / sort row */}
      <div class="flex items-center gap-1 px-4 py-2">
        {/* Account filter */}
        <div class="relative">
          <button
            type="button"
            onClick={() => props.onDropdownToggle("account")}
            class={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
              props.filterAccountId
                ? "bg-purple-600 text-white"
                : "text-fg-3 hover:bg-surface-hover hover:text-fg",
            )}
            aria-label="Filter by account"
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
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </button>
          <Show when={props.activeDropdown === "account"}>
            <div class="fixed inset-0 z-20" onClick={props.onDropdownClose} />
            <div class="absolute top-9 left-0 z-30 bg-white dark:bg-[#1e1a2e] border border-dim rounded-xl shadow-lg min-w-[160px] py-1 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  props.onAccountFilter(null);
                  props.onDropdownClose();
                }}
                class={cn(
                  "w-full text-left px-4 py-2 text-sm transition-colors hover:bg-surface-hover",
                  !props.filterAccountId
                    ? "text-purple-400 font-semibold"
                    : "text-fg",
                )}
              >
                All accounts
              </button>
              <For each={accountsQuery.data ?? []}>
                {(acc) => (
                  <button
                    type="button"
                    onClick={() => {
                      props.onAccountFilter(acc.id);
                      props.onDropdownClose();
                    }}
                    class={cn(
                      "w-full text-left px-4 py-2 text-sm truncate transition-colors hover:bg-surface-hover",
                      props.filterAccountId === acc.id
                        ? "text-purple-400 font-semibold"
                        : "text-fg",
                    )}
                  >
                    {acc.name}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Category filter */}
        <div class="relative">
          <button
            type="button"
            onClick={() => props.onDropdownToggle("category")}
            class={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
              props.filterCategoryId
                ? "bg-purple-600 text-white"
                : "text-fg-3 hover:bg-surface-hover hover:text-fg",
            )}
            aria-label="Filter by category"
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
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
          </button>
          <Show when={props.activeDropdown === "category"}>
            <div class="fixed inset-0 z-20" onClick={props.onDropdownClose} />
            <div class="absolute top-9 left-0 z-30 bg-white dark:bg-[#1e1a2e] border border-dim rounded-xl shadow-lg min-w-[160px] max-h-56 py-1 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  props.onCategoryFilter(null);
                  props.onDropdownClose();
                }}
                class={cn(
                  "w-full text-left px-4 py-2 text-sm transition-colors hover:bg-surface-hover",
                  !props.filterCategoryId
                    ? "text-purple-400 font-semibold"
                    : "text-fg",
                )}
              >
                All categories
              </button>
              <For each={categoriesQuery.data ?? []}>
                {(cat) => (
                  <button
                    type="button"
                    onClick={() => {
                      props.onCategoryFilter(cat.id);
                      props.onDropdownClose();
                    }}
                    class={cn(
                      "w-full text-left px-4 py-2 text-sm truncate transition-colors hover:bg-surface-hover",
                      props.filterCategoryId === cat.id
                        ? "text-purple-400 font-semibold"
                        : "text-fg",
                    )}
                  >
                    {cat.icon ? cat.icon + " " : ""}
                    {cat.name}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        {/* Divider */}
        <div class="w-px h-4 bg-dim mx-1" />

        {/* Sort toggle */}
        <button
          type="button"
          onClick={props.onSortToggle}
          class={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
            props.sortDir === "asc"
              ? "bg-purple-600 text-white"
              : "text-fg-3 hover:bg-surface-hover hover:text-fg",
          )}
          aria-label={
            props.sortDir === "desc"
              ? "Newest first — tap to sort oldest first"
              : "Oldest first — tap to sort newest first"
          }
        >
          <Show
            when={props.sortDir === "desc"}
            fallback={
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
                  d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                />
              </svg>
            }
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
                d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
              />
            </svg>
          </Show>
        </button>

        {/* Active filter labels */}
        <div class="flex-1 flex items-center gap-1 min-w-0 ml-1 overflow-hidden">
          <Show when={props.filterAccountId}>
            <span class="text-xs text-purple-400 truncate">
              {accountName(props.filterAccountId!)}
            </span>
          </Show>
          <Show when={props.filterAccountId && props.filterCategoryId}>
            <span class="text-fg-4 text-xs flex-shrink-0">·</span>
          </Show>
          <Show when={props.filterCategoryId}>
            <span class="text-xs text-purple-400 truncate">
              {categoryIcon(props.filterCategoryId!)
                ? categoryIcon(props.filterCategoryId!) + " "
                : ""}
              {categoryName(props.filterCategoryId!)}
            </span>
          </Show>
        </div>

        {/* Clear filters */}
        <Show when={props.filterAccountId || props.filterCategoryId}>
          <button
            type="button"
            onClick={props.onClearFilters}
            class="w-8 h-8 rounded-lg flex items-center justify-center text-fg-4 hover:text-fg transition-colors flex-shrink-0"
            aria-label="Clear filters"
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
        </Show>
      </div>
    </div>
  );
}
