import { createEffect, createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { createMutation, createQuery, useQueryClient } from "@tanstack/solid-query";
import { createTransaction, fetchAccounts, fetchCategories } from "../lib/api";
import { cn } from "../lib/cn";
import ManageCategoriesModal from "./ManageCategoriesModal";

type Props = {
  onClose: () => void;
};

export default function TransactionSheet(props: Props) {
  const [amount, setAmount] = createSignal("");
  const [categoryId, setCategoryId] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [accountId, setAccountId] = createSignal("");
  const [toAccountId, setToAccountId] = createSignal("");
  const [mode, setMode] = createSignal<"expense" | "income" | "transfer">("expense");
  const [showManageCategories, setShowManageCategories] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  const queryClient = useQueryClient();

  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  }));

  const categoriesQuery = createQuery(() => ({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  }));

  const categories = () => categoriesQuery.data ?? [];

  // Set default account and category selection once data is available
  createEffect(() => {
    const accs = accountsQuery.data;
    if (accs && accs.length > 0 && !accountId()) {
      setAccountId(accs[0].id);
      if (accs.length > 1) setToAccountId(accs[1].id);
    }
  });

  createEffect(() => {
    const cats = categoriesQuery.data;
    if (cats && cats.length > 0 && !categoryId()) {
      const general = cats.find((c) => c.name === "General");
      setCategoryId(general?.id ?? cats[0].id);
    }
  });

  onMount(() => {
    document.body.style.overflow = "hidden";
    inputRef?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
      if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  onCleanup(() => {
    document.body.style.overflow = "";
  });

  const mutation = createMutation(() => ({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      props.onClose();
    },
  }));

  const handleSubmit = () => {
    const parsed = parseFloat(amount());
    if (!parsed || parsed <= 0) {
      inputRef?.focus();
      return;
    }
    if (!accountId()) return;
    if (mode() === "transfer" && !toAccountId()) return;

    mutation.mutate({
      amount: parsed,
      type: mode(),
      category_id: mode() === "transfer" ? undefined : categoryId(),
      description: description() || undefined,
      account_id: accountId(),
      to_account_id: mode() === "transfer" ? toAccountId() : undefined,
    });
  };

  const accounts = () => accountsQuery.data ?? [];

  return (
    <>
      {/* Backdrop */}
      <div
        class="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={props.onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add transaction"
        class="fixed inset-x-0 bottom-0 z-50 bg-sheet-bg rounded-t-3xl px-6 pt-4 pb-10 sheet-enter max-h-[90vh] overflow-y-auto"
      >
        {/* Handle bar */}
        <div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

        {/* Amount input */}
        <label for="amount-input" class="sr-only">
          Amount
        </label>
        <input
          id="amount-input"
          ref={inputRef}
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount()}
          onInput={(e) => setAmount(e.currentTarget.value)}
          class="w-full text-6xl font-bold bg-transparent text-white text-center outline-none mb-2 placeholder:text-white/20"
        />
        <p class="text-center text-gray-500 text-sm mb-6">Enter amount</p>

        {/* Mode toggle */}
        <div class="flex bg-white/5 rounded-xl p-1 mb-4">
          <button
            type="button"
            onClick={() => setMode("expense")}
            class={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
              mode() === "expense" ? "bg-purple-600 text-white" : "text-gray-500",
            )}
          >
            Spent
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("income");
              const selectedAcc = accounts().find((a) => a.id === accountId());
              if (selectedAcc?.type === "credit") {
                setAccountId(accounts().find((a) => a.type !== "credit")?.id ?? "");
              }
            }}
            class={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
              mode() === "income" ? "bg-blue-600 text-white" : "text-gray-500",
            )}
          >
            Earned
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("transfer");
              const accs = accounts();
              if (accs.find((a) => a.id === accountId())?.type === "credit") {
                setAccountId(accs.find((a) => a.type !== "credit")?.id ?? "");
              }
              if (accs.find((a) => a.id === toAccountId())?.type === "credit") {
                setToAccountId("");
              }
            }}
            class={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
              mode() === "transfer" ? "bg-cyan-500 text-white" : "text-gray-500",
            )}
          >
            Transfer
          </button>
        </div>

        {/* Account selector */}
        <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">
          {mode() === "transfer" ? "From" : "Account"}
        </p>
        <div class="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          <For
            each={accounts().filter(
              (a) =>
                mode() !== "income" && mode() !== "transfer"
                  ? true
                  : a.type !== "credit",
            )}
          >
            {(acc) => (
              <button
                type="button"
                onClick={() => setAccountId(acc.id)}
                class={cn(
                  "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  accountId() === acc.id
                    ? "bg-purple-600 text-white"
                    : "bg-white/5 text-gray-400 hover:bg-white/10",
                )}
              >
                {acc.name}
              </button>
            )}
          </For>
        </div>

        {/* To account (transfer mode only) */}
        <Show when={mode() === "transfer"}>
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">To</p>
          <div class="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
            <For
              each={accounts().filter(
                (a) => a.id !== accountId() && a.type !== "credit",
              )}
            >
              {(acc) => (
                <button
                  type="button"
                  onClick={() => setToAccountId(acc.id)}
                  class={cn(
                    "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    toAccountId() === acc.id
                      ? "bg-cyan-500 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10",
                  )}
                >
                  {acc.name}
                </button>
              )}
            </For>
          </div>
        </Show>

        {/* Category pills (hidden in transfer mode) */}
        <Show when={mode() !== "transfer"}>
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs text-gray-500 uppercase tracking-wider">
              Category
            </p>
            <button
              type="button"
              onClick={() => setShowManageCategories(true)}
              class="p-1 text-gray-500 hover:text-white transition-colors"
              aria-label="Manage categories"
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
          <div class="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
            <For each={categories()}>
              {(cat) => (
                <button
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  class={cn(
                    "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    categoryId() === cat.id
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10",
                  )}
                >
                  {cat.icon} {cat.name}
                </button>
              )}
            </For>
          </div>
        </Show>

        <Show when={showManageCategories()}>
          <ManageCategoriesModal onClose={() => setShowManageCategories(false)} />
        </Show>

        {/* Description */}
        <input
          type="text"
          placeholder="Description (optional)"
          value={description()}
          onInput={(e) => setDescription(e.currentTarget.value)}
          class="w-full bg-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 outline-none focus:ring-1 focus:ring-purple-500 mb-6"
        />

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={mutation.isPending}
          class={cn(
            "w-full py-4 rounded-2xl active:scale-95 text-white font-semibold text-lg transition-all disabled:opacity-50",
            mode() === "expense"
              ? "bg-purple-600 hover:bg-purple-500"
              : mode() === "transfer"
                ? "bg-cyan-500 hover:bg-cyan-400"
                : "bg-blue-600 hover:bg-blue-500",
          )}
        >
          {mode() === "expense"
            ? "Add Expense"
            : mode() === "transfer"
              ? "Transfer"
              : "Add Income"}
        </button>
      </div>
    </>
  );
}
