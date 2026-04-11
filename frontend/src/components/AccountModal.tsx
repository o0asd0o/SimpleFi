import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { createMutation, useQueryClient } from "@tanstack/solid-query";
import { createAccount, CreateAccountInput } from "../lib/api";
import { clsx as cn } from "clsx";
import SlidePanel from "./SlidePanel";

type Props = {
  onClose: () => void;
};

const ACCOUNT_TYPES: CreateAccountInput["type"][] = [
  "cash",
  "credit",
  "debit",
  "savings",
];

export default function AccountModal(props: Props) {
  const [name, setName] = createSignal("");
  const [accountType, setAccountType] =
    createSignal<CreateAccountInput["type"]>("savings");
  const [initialBalance, setInitialBalance] = createSignal("0");
  let inputRef: HTMLInputElement | undefined;
  const queryClient = useQueryClient();

  onMount(() => {
    inputRef?.focus();
  });

  const mutation = createMutation(() => ({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      props.onClose();
    },
  }));

  const handleSubmit = () => {
    if (!name().trim()) {
      inputRef?.focus();
      return;
    }
    const balance = parseFloat(initialBalance()) || 0;
    mutation.mutate({
      name: name().trim(),
      type: accountType(),
      initial_balance: balance > 0 ? balance : undefined,
    });
  };

  return (
    <SlidePanel onClose={props.onClose} ariaLabel="Add account">
      {(isDesktop) => (
        <div class="px-6 pt-4 pb-safe-sheet">
          <Show when={!isDesktop()}>
            <div class="w-10 h-1 bg-handle rounded-full mx-auto mb-6" />
          </Show>
          <h2 class="text-fg font-semibold text-xl text-center mb-6">
            New Account
          </h2>

          <label class="text-xs text-fg-3 uppercase tracking-wider mb-2 block">
            Account Name
          </label>
          <input
            ref={inputRef}
            type="text"
            placeholder="e.g. BPI Savings"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            class="w-full bg-surface rounded-xl px-4 py-3 text-fg text-sm placeholder:text-fg-4 outline-none focus:ring-1 focus:ring-purple-500 mb-4"
          />

          <p class="text-xs text-fg-3 uppercase tracking-wider mb-2">Type</p>
          <div class="flex gap-2 mb-6">
            <For each={ACCOUNT_TYPES}>
              {(t) => (
                <button
                  type="button"
                  onClick={() => setAccountType(t)}
                  class={cn(
                    "flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors",
                    accountType() === t
                      ? "bg-purple-600 text-white"
                      : "bg-surface text-fg-2 hover:bg-surface-hover",
                  )}
                >
                  {t}
                </button>
              )}
            </For>
          </div>

          <label class="text-xs text-fg-3 uppercase tracking-wider mb-2 block">
            Initial Balance
          </label>
          <div class="relative mb-6">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-fg-3 text-sm">
              ₱
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0"
              value={initialBalance()}
              onInput={(e) => setInitialBalance(e.currentTarget.value)}
              onFocus={(e) =>
                e.currentTarget.value === "0" && (e.currentTarget.value = "")
              }
              onBlur={(e) => !e.currentTarget.value && setInitialBalance("0")}
              class="w-full bg-surface rounded-xl pl-8 pr-4 py-3 text-fg text-sm placeholder:text-fg-4 outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <Show when={mutation.isError}>
            <p class="text-red-400 text-sm text-center mb-4">
              Could not create account. Is the backend running?
            </p>
          </Show>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            class="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-semibold text-lg transition-all disabled:opacity-50"
          >
            {mutation.isPending ? "Creating…" : "Create Account"}
          </button>
        </div>
      )}
    </SlidePanel>
  );
}
