import { createSignal, onCleanup, onMount, For, Show } from "solid-js";
import { createMutation, useQueryClient } from "@tanstack/solid-query";
import { createAccount, CreateAccountInput } from "../lib/api";
import { clsx as cn } from "clsx";
import { getScrollbarOffset, lockBodyScroll } from "../lib/scroll-lock";

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
  const scrollbarOffset = getScrollbarOffset();
  const [name, setName] = createSignal("");
  const [accountType, setAccountType] =
    createSignal<CreateAccountInput["type"]>("savings");
  let inputRef: HTMLInputElement | undefined;
  let unlockBodyScroll = () => {};
  const queryClient = useQueryClient();

  onMount(() => {
    unlockBodyScroll = lockBodyScroll();
    inputRef?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  onCleanup(() => {
    unlockBodyScroll();
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
    mutation.mutate({ name: name().trim(), type: accountType() });
  };

  return (
    <>
      <div
        class="fixed inset-0 bg-overlay z-40 backdrop-blur-sm"
        onClick={props.onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add account"
        class="fixed inset-x-0 bottom-0 z-50 bg-sheet-bg rounded-t-3xl px-6 pt-4 pb-10 sheet-enter max-w-md mx-auto"
        style={{ right: `${scrollbarOffset}px` }}
      >
        <div class="w-10 h-1 bg-handle rounded-full mx-auto mb-6" />
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
    </>
  );
}
