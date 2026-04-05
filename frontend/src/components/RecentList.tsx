import { createEffect, createSignal, For, on, Show } from "solid-js";
import { createInfiniteQuery, createMutation, createQuery, useQueryClient } from "@tanstack/solid-query";
import { deleteTransaction, fetchTransactions, fetchAccounts, fetchCategories, type Transaction } from "../lib/api";
import { cn } from "../lib/cn";

const PAGE_SIZE = 15;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

type Props = {
  onEdit: (tx: Transaction) => void;
};

export default function RecentList(props: Props) {
  const [openId, setOpenId] = createSignal<string | null>(null);
  const queryClient = useQueryClient();

  const txQuery = createInfiniteQuery(() => ({
    queryKey: ["transactions"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchTransactions(PAGE_SIZE, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  }));

  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  }));
  const categoriesQuery = createQuery(() => ({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  }));

  const transactions = () =>
    txQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const accountName = (id: string) =>
    (accountsQuery.data ?? []).find((a) => a.id === id)?.name ?? "";
  const categoryIcon = (id: string) =>
    (categoriesQuery.data ?? []).find((c) => c.id === id)?.icon ?? "";

  const deleteMut = createMutation(() => ({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-summary"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      setOpenId(null);
    },
  }));

  // Intersection observer for triggering next page load
  let sentinelRef: HTMLDivElement | undefined;
  let observer: IntersectionObserver | undefined;

  const setupObserver = (el: HTMLDivElement) => {
    sentinelRef = el;
    observer?.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && txQuery.hasNextPage && !txQuery.isFetchingNextPage) {
          txQuery.fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
  };

  createEffect(
    on(
      () => [txQuery.hasNextPage, txQuery.isFetchingNextPage] as const,
      () => {
        if (sentinelRef && observer) {
          observer.disconnect();
          observer.observe(sentinelRef);
        }
      },
    ),
  );

  return (
    <section aria-label="Recent transactions">
      <Show
        when={transactions().length > 0}
        fallback={
          <Show when={!txQuery.isLoading}>
            <div class="text-center py-20 px-6">
              <p class="text-3xl mb-3">💸</p>
              <p class="text-white font-medium mb-1">No transactions yet</p>
              <p class="text-gray-500 text-sm">Tap + to log your first one</p>
            </div>
          </Show>
        }
      >
        <ul>
          <For each={transactions()}>
            {(tx) => {
              let touchStartX = 0;
              let touchStartY = 0;

              const isOpen = () => openId() === tx.id;

              const handleTouchStart = (e: TouchEvent) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                // Close any other open item
                if (openId() !== null && openId() !== tx.id) setOpenId(null);
              };

              const handleTouchEnd = (e: TouchEvent) => {
                const dx = e.changedTouches[0].clientX - touchStartX;
                const dy = e.changedTouches[0].clientY - touchStartY;
                // Ignore if more vertical than horizontal
                if (Math.abs(dx) < Math.abs(dy)) return;
                if (dx < -40) setOpenId(tx.id);
                else if (dx > 20 && isOpen()) setOpenId(null);
              };

              return (
                <li class="overflow-hidden">
                  {/* Sliding wrapper — contains row + action buttons side by side */}
                  <div
                    class="flex transition-transform duration-200 ease-out"
                    style={{ transform: isOpen() ? "translateX(-144px)" : "translateX(0)" }}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => { if (isOpen()) setOpenId(null); }}
                  >
                    {/* Row content */}
                    <div class="flex items-center gap-4 px-6 py-4 border-b border-white/5 w-full flex-shrink-0">
                      <div
                        class={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          tx.type === "expense"
                            ? "bg-purple-500"
                            : tx.type === "transfer"
                              ? "bg-cyan-400"
                              : "bg-blue-400",
                        )}
                      />
                      <div class="flex-1 min-w-0">
                        <p class="text-white text-sm font-medium truncate">
                          <Show
                            when={tx.type === "transfer"}
                            fallback={
                              <>
                                {tx.category_id ? categoryIcon(tx.category_id) + " " : ""}
                                {tx.description || tx.category}
                              </>
                            }
                          >
                            {accountName(tx.account_id)} →{" "}
                            {accountName(tx.to_account_id ?? "")}
                          </Show>
                        </p>
                        <p class="text-gray-500 text-xs mt-0.5">
                          <Show
                            when={tx.type === "transfer"}
                            fallback={
                              <>
                                {tx.description ? tx.category + " · " : ""}
                                {tx.account_id
                                  ? accountName(tx.account_id) + " · "
                                  : ""}
                                {formatDate(tx.created_at)}
                              </>
                            }
                          >
                            Transfer · {formatDate(tx.created_at)}
                          </Show>
                        </p>
                      </div>
                      <span
                        class={cn(
                          "font-mono text-sm font-medium flex-shrink-0",
                          tx.type === "expense"
                            ? "text-purple-400"
                            : tx.type === "transfer"
                              ? "text-cyan-400"
                              : "text-blue-400",
                        )}
                      >
                        {tx.type === "expense" ? "-" : tx.type === "income" ? "+" : ""}
                        ₱{fmt(tx.amount)}
                      </span>
                    </div>

                    {/* Edit button — revealed on swipe */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenId(null); props.onEdit(tx); }}
                      class="w-[72px] flex-shrink-0 bg-blue-500 flex flex-col items-center justify-center gap-1 text-white"
                      aria-label="Edit transaction"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span class="text-[10px] font-semibold uppercase tracking-wide">Edit</span>
                    </button>

                    {/* Delete button — revealed on swipe */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteMut.mutate(tx.id); }}
                      disabled={deleteMut.isPending}
                      class="w-[72px] flex-shrink-0 bg-red-500 flex flex-col items-center justify-center gap-1 text-white disabled:opacity-60"
                      aria-label="Delete transaction"
                    >
                      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span class="text-[10px] font-semibold uppercase tracking-wide">Delete</span>
                    </button>
                  </div>
                </li>
              );
            }}
          </For>
        </ul>

        {/* Sentinel — triggers next page when scrolled near */}
        <div ref={setupObserver}>
          <Show when={txQuery.isFetchingNextPage}>
            <div class="flex justify-center py-6">
              <div class="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </Show>
        </div>
      </Show>
    </section>
  );
}
