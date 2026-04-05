import { For, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { fetchTransactions, fetchAccounts, fetchCategories } from "../lib/api";
import { cn } from "../lib/cn";

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

export default function RecentList() {
  const transactionsQuery = createQuery(() => ({
    queryKey: ["transactions"],
    queryFn: fetchTransactions,
  }));
  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  }));
  const categoriesQuery = createQuery(() => ({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  }));

  const transactions = () => transactionsQuery.data ?? [];
  const accountName = (id: string) =>
    (accountsQuery.data ?? []).find((a) => a.id === id)?.name ?? "";
  const categoryIcon = (id: string) =>
    (categoriesQuery.data ?? []).find((c) => c.id === id)?.icon ?? "";

  return (
    <section aria-label="Recent transactions">
      <Show
        when={transactions().length > 0}
        fallback={
          <div class="text-center py-20 px-6">
            <p class="text-3xl mb-3">💸</p>
            <p class="text-white font-medium mb-1">No transactions yet</p>
            <p class="text-gray-500 text-sm">Tap + to log your first one</p>
          </div>
        }
      >
        <ul>
          <For each={transactions()}>
            {(tx) => (
              <li class="flex items-center gap-4 px-6 py-4 border-b border-white/5">
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
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}
