import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  For,
  Show,
} from "solid-js";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import {
  createTransaction,
  updateTransaction,
  fetchAccounts,
  fetchCategories,
  fetchRecurringRules,
  fetchMe,
  fetchPartnerships,
  updateRecurringRule,
  deleteRecurringRule,
  type Transaction,
  type Frequency,
  type RecurringRule,
  type Account,
} from "../lib/api";
import { clsx as cn } from "clsx";
import { getScrollbarOffset, lockBodyScroll } from "../lib/scroll-lock";
import ManageCategoriesModal from "./ManageCategoriesModal";

type Props = {
  onClose: () => void;
  editTransaction?: Transaction;
  activePartnershipId: string | null;
  initialMode?: "expense" | "income" | "transfer";
  initialToAccountId?: string;
};

const FORM_QUERY_STALE_TIME = 60_000;

const formQueryOptions = {
  staleTime: FORM_QUERY_STALE_TIME,
  refetchOnMount: false as const,
  refetchOnWindowFocus: false as const,
  refetchOnReconnect: false as const,
};

export default function TransactionSheet(props: Props) {
  const scrollbarOffset = getScrollbarOffset();
  const editing = () => props.editTransaction;
  const [amount, setAmount] = createSignal(editing()?.amount?.toString() ?? "");
  const [categoryId, setCategoryId] = createSignal(
    editing()?.category_id ?? "",
  );
  const [description, setDescription] = createSignal(
    editing()?.description ?? "",
  );
  const [accountId, setAccountId] = createSignal(editing()?.account_id ?? "");
  const [toAccountId, setToAccountId] = createSignal(
    editing()?.to_account_id ?? props.initialToAccountId ?? "",
  );
  const [mode, setMode] = createSignal<"expense" | "income" | "transfer">(
    editing()?.type ?? props.initialMode ?? "expense",
  );
  const [showManageCategories, setShowManageCategories] = createSignal(false);
  const [showRecurringModal, setShowRecurringModal] = createSignal(false);
  const [isRecurring, setIsRecurring] = createSignal(
    !!editing()?.recurring_rule_id,
  );
  const [frequency, setFrequency] = createSignal<Frequency>("monthly");
  const [startDate, setStartDate] = createSignal(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = createSignal("");
  let inputRef: HTMLInputElement | undefined;
  let unlockBodyScroll = () => {};

  const queryClient = useQueryClient();

  const formattedAmount = () => {
    const raw = amount();
    if (!raw) return "";
    const parts = raw.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  };

  const sanitizeAmountValue = (value: string) => {
    const stripped = value.replace(/[^0-9.]/g, "");
    const [whole = "", ...fractionParts] = stripped.split(".");

    if (fractionParts.length === 0) {
      return whole;
    }

    return `${whole}.${fractionParts.join("")}`;
  };

  const handleAmountInput = (e: InputEvent) => {
    const val = (e.currentTarget as HTMLInputElement).value;
    setAmount(sanitizeAmountValue(val));
  };

  const handleAmountKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const allowedKeys = new Set([
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "Tab",
      "Enter",
      "Escape",
    ]);

    if (allowedKeys.has(e.key)) return;

    if (/^[0-9]$/.test(e.key)) return;

    if (e.key === ".") {
      const input = e.currentTarget as HTMLInputElement;
      const selectionStart = input.selectionStart ?? 0;
      const selectionEnd = input.selectionEnd ?? selectionStart;
      const selectedText = input.value.slice(selectionStart, selectionEnd);

      if (!amount().includes(".") || selectedText.includes(".")) {
        return;
      }
    }

    e.preventDefault();
  };

  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts", props.activePartnershipId],
    queryFn: () => fetchAccounts(props.activePartnershipId),
    ...formQueryOptions,
  }));

  const meQuery = createQuery(() => ({
    queryKey: ["me"],
    queryFn: fetchMe,
    ...formQueryOptions,
  }));

  const partnershipsQuery = createQuery(() => ({
    queryKey: ["partnerships"],
    queryFn: fetchPartnerships,
    enabled: props.activePartnershipId !== null,
    ...formQueryOptions,
  }));

  const categoriesQuery = createQuery(() => ({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    ...formQueryOptions,
  }));

  const recurringRulesQuery = createQuery(() => ({
    queryKey: ["recurring-rules"],
    queryFn: fetchRecurringRules,
    enabled: !!editing(),
    ...formQueryOptions,
  }));

  const myId = () => meQuery.data?.id ?? "";

  const isCouple = () => {
    if (!props.activePartnershipId) return false;
    const p = partnershipsQuery.data?.find(
      (x) => x.id === props.activePartnershipId,
    );
    return p?.type === "couple";
  };

  const ownAccounts = (accs: Account[]) =>
    accs.filter((a) => !a.owner_user_id || a.owner_user_id === myId());

  const accounts = () => accountsQuery.data ?? [];

  // Accounts available to select as FROM account
  const expenseFromAccounts = createMemo(() =>
    isCouple() ? accounts() : ownAccounts(accounts()),
  );
  const nonCreditOwnAccounts = createMemo(() =>
    ownAccounts(accounts()).filter((a) => a.type !== "credit"),
  );

  // For income + transfer: couple context includes partner's non-credit accounts
  const nonCreditAccounts = createMemo(() => {
    const base = isCouple() ? accounts() : ownAccounts(accounts());
    return base.filter((a) => a.type !== "credit");
  });

  // Transfer "To" allows ALL account types including credit (pay off credit card)
  const transferToAccounts = createMemo(() => {
    const base = isCouple() ? accounts() : ownAccounts(accounts());
    return base.filter((a) => a.id !== accountId());
  });

  const isPayingCreditCard = () =>
    mode() === "transfer" &&
    accounts().find((a) => a.id === toAccountId())?.type === "credit";

  // Pre-populate recurring state from existing rule when editing
  const [recurringInitialized, setRecurringInitialized] = createSignal(false);
  const [matchedRuleId, setMatchedRuleId] = createSignal<string | undefined>();
  createEffect(() => {
    const tx = editing();
    const rules = recurringRulesQuery.data;
    if (!tx || !rules || recurringInitialized()) return;

    let rule: RecurringRule | undefined;
    if (tx.recurring_rule_id) {
      rule = rules.find((r) => r.id === tx.recurring_rule_id);
    }
    if (!rule) {
      rule = rules.find(
        (r) =>
          r.amount === tx.amount &&
          r.type === tx.type &&
          r.account_id === tx.account_id,
      );
    }
    if (rule) {
      setIsRecurring(true);
      setFrequency(rule.frequency);
      setStartDate(rule.next_due);
      setEndDate(rule.end_date ?? "");
      setMatchedRuleId(rule.id);
    }
    setRecurringInitialized(true);
  });

  const categories = () => categoriesQuery.data ?? [];
  const filteredCategories = () =>
    categories().filter(
      (c) => c.type === mode() && c.id !== "cat-card-payment",
    );

  createEffect(() => {
    const accs = accountsQuery.data;
    if (accs && accs.length > 0 && !accountId()) {
      const first = ownAccounts(accs)[0] ?? accs[0];
      setAccountId(first.id);
      const secondOwn = ownAccounts(accs).find((a) => a.id !== first.id);
      if (secondOwn && !toAccountId()) setToAccountId(secondOwn.id);
    }
  });

  createEffect(() => {
    const cats = categoriesQuery.data;
    const m = mode();
    if (!cats || m === "transfer") return;
    if (editing() && categoryId()) return;
    const typed = cats.filter((c) => c.type === m);
    if (typed.length === 0) return;
    const defaultName = m === "expense" ? "General" : "Salary";
    const def = typed.find((c) => c.name === defaultName);
    setCategoryId(def?.id ?? typed[0].id);
  });

  onMount(() => {
    unlockBodyScroll = lockBodyScroll();
    inputRef?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
      if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  onCleanup(() => {
    unlockBodyScroll();
  });

  const mutation = createMutation(() => ({
    mutationFn: async (data: Parameters<typeof createTransaction>[0]) => {
      const tx = editing();
      const result = tx
        ? await updateTransaction(tx.id, data)
        : await createTransaction(data);

      if (tx) {
        const ruleId = tx.recurring_rule_id || matchedRuleId();
        const hadRule = !!ruleId;
        const wantsRecurring = isRecurring();

        if (hadRule && !wantsRecurring) {
          await deleteRecurringRule(ruleId!);
        } else if (hadRule && wantsRecurring) {
          await updateRecurringRule(ruleId!, {
            frequency: frequency(),
            next_due: startDate(),
            end_date: endDate() || undefined,
          });
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transactions-summary"] });
      queryClient.invalidateQueries({ queryKey: ["statistics"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-rules"] });
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

    const payingCredit = isPayingCreditCard();

    mutation.mutate({
      amount: parsed,
      type: payingCredit ? "expense" : mode(),
      category_id: payingCredit
        ? "cat-card-payment"
        : mode() === "transfer"
          ? undefined
          : categoryId(),
      description: description() || undefined,
      account_id: accountId(),
      to_account_id: mode() === "transfer" ? toAccountId() : undefined,
      recurring: isRecurring() ? true : undefined,
      frequency: isRecurring() ? frequency() : undefined,
      start_date: isRecurring() ? startDate() : undefined,
      end_date: isRecurring() && endDate() ? endDate() : undefined,
    });
  };

  const accountLabel = (acc: Account) => {
    const isPartner = acc.owner_user_id && acc.owner_user_id !== myId();
    if (isPartner && acc.owner_name) return `${acc.owner_name}: ${acc.name}`;
    return acc.name;
  };

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
        aria-label={editing() ? "Edit transaction" : "Add transaction"}
        class="fixed inset-x-0 bottom-0 z-50 bg-sheet-bg rounded-t-3xl px-6 pt-4 pb-10 sheet-enter max-h-[90vh] overflow-y-auto"
        style={{ right: `${scrollbarOffset}px` }}
      >
        {/* Handle bar */}
        <div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

        {/* Mode toggle */}
        <div class="flex bg-white/5 rounded-xl p-1 mb-4">
          <button
            type="button"
            onClick={() => setMode("expense")}
            class={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
              mode() === "expense"
                ? "bg-purple-600 text-white"
                : "text-gray-500",
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
                setAccountId(nonCreditOwnAccounts()[0]?.id ?? "");
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
              // Clear "From" if it's credit — can't transfer FROM credit card
              if (
                accounts().find((a) => a.id === accountId())?.type === "credit"
              ) {
                setAccountId(nonCreditOwnAccounts()[0]?.id ?? "");
              }
              // Do NOT clear credit "To" — credit is a valid transfer destination
            }}
            class={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
              mode() === "transfer"
                ? "bg-cyan-500 text-white"
                : "text-gray-500",
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
            each={
              mode() === "expense" ? expenseFromAccounts() : nonCreditAccounts()
            }
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
                {accountLabel(acc)}
              </button>
            )}
          </For>
        </div>

        {/* To account (transfer mode only) */}
        <Show when={mode() === "transfer"}>
          <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">
            {isPayingCreditCard() ? "Pay to" : "To"}
          </p>
          <div class="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
            <For each={transferToAccounts()}>
              {(acc) => (
                <button
                  type="button"
                  onClick={() => setToAccountId(acc.id)}
                  class={cn(
                    "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                    toAccountId() === acc.id
                      ? acc.type === "credit"
                        ? "bg-purple-600 text-white"
                        : "bg-cyan-500 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10",
                  )}
                >
                  {accountLabel(acc)}
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
            <For each={filteredCategories()}>
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
          <ManageCategoriesModal
            categoryType={mode() === "income" ? "income" : "expense"}
            onClose={() => setShowManageCategories(false)}
          />
        </Show>

        {/* Amount input */}
        <label for="amount-input" class="sr-only">
          Amount
        </label>
        <input
          id="amount-input"
          ref={inputRef}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={formattedAmount()}
          onKeyDown={handleAmountKeyDown}
          onInput={handleAmountInput}
          class="w-full text-6xl font-bold bg-transparent text-white text-center outline-none mb-2 placeholder:text-white/20"
        />
        <p class="text-center text-gray-500 text-sm mb-6">Enter amount</p>

        {/* Description + Repeat */}
        <div class="relative flex items-center gap-2 mb-6">
          <input
            type="text"
            placeholder="Description (optional)"
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
            class="flex-1 min-w-0 bg-white/5 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 outline-none focus:ring-1 focus:ring-purple-500"
          />
          <button
            type="button"
            onClick={() => setShowRecurringModal(true)}
            class={cn(
              "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
              isRecurring()
                ? "bg-purple-600/30 ring-1 ring-purple-500"
                : "bg-white/5",
            )}
            aria-label="Set recurring"
          >
            <svg
              class={cn(
                "w-5 h-5",
                isRecurring() ? "text-purple-400" : "text-gray-500",
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Recurring modal */}
        <Show when={showRecurringModal()}>
          <div
            class="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            onClick={() => setShowRecurringModal(false)}
          />
          <div
            class="fixed inset-x-0 bottom-0 z-[70] bg-sheet-bg rounded-t-3xl px-6 pt-4 pb-10 sheet-enter"
            style={{ right: `${scrollbarOffset}px` }}
          >
            <div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            <h3 class="text-white font-semibold text-lg mb-6">Repeat</h3>

            {/* Frequency pills */}
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Occurrence
            </p>
            <div class="flex gap-2 flex-wrap mb-6">
              <For
                each={
                  [
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                    { value: "biweekly", label: "Every 2 Weeks" },
                    { value: "monthly", label: "Monthly" },
                    { value: "yearly", label: "Yearly" },
                  ] as { value: Frequency; label: string }[]
                }
              >
                {(opt) => (
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecurring(true);
                      setFrequency(opt.value);
                    }}
                    class={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                      isRecurring() && frequency() === opt.value
                        ? "bg-purple-600 text-white"
                        : "bg-white/5 text-gray-400 hover:bg-white/10",
                    )}
                  >
                    {opt.label}
                  </button>
                )}
              </For>
            </div>

            {/* Start date */}
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">
              {editing() ? "Next due" : "Start date"}
            </p>
            <input
              type="date"
              value={startDate()}
              onInput={(e) => setStartDate(e.currentTarget.value)}
              class="w-full bg-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-purple-500 mb-4 [color-scheme:dark]"
            />

            {/* End date (optional) */}
            <div class="flex items-center justify-between mb-2">
              <p class="text-xs text-gray-500 uppercase tracking-wider">
                End date
              </p>
              <Show when={endDate()}>
                <button
                  type="button"
                  onClick={() => setEndDate("")}
                  class="text-xs text-purple-400"
                >
                  Clear
                </button>
              </Show>
            </div>
            <input
              type="date"
              value={endDate()}
              onInput={(e) => setEndDate(e.currentTarget.value)}
              min={startDate()}
              placeholder="Indefinite"
              class="w-full bg-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none focus:ring-1 focus:ring-purple-500 mb-2 [color-scheme:dark]"
            />
            <p class="text-xs text-gray-500 mb-6">
              {endDate() ? "" : "No end date — repeats indefinitely"}
            </p>

            {/* Actions */}
            <div class="flex gap-3">
              <Show when={isRecurring()}>
                <button
                  type="button"
                  onClick={() => {
                    setIsRecurring(false);
                    setShowRecurringModal(false);
                  }}
                  class="flex-1 py-3 rounded-2xl bg-white/5 text-gray-400 font-medium text-sm"
                >
                  Turn Off
                </button>
              </Show>
              <button
                type="button"
                onClick={() => setShowRecurringModal(false)}
                class="flex-1 py-3 rounded-2xl bg-purple-600 text-white font-semibold text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </Show>

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
          {editing()
            ? "Save Changes"
            : mode() === "expense"
              ? "Add Expense"
              : mode() === "transfer"
                ? isPayingCreditCard()
                  ? "Pay Credit Card"
                  : "Transfer"
                : "Add Income"}
        </button>
      </div>
    </>
  );
}
