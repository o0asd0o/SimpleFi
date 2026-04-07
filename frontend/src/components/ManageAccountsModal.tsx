import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import {
  createQuery,
  createMutation,
  useQueryClient,
} from "@tanstack/solid-query";
import {
  fetchAccounts,
  fetchMe,
  fetchPartnerships,
  updateAccount,
  deleteAccount,
  setAccountPrivacy,
  type Account,
  type CreateAccountInput,
} from "../lib/api";
import { cn } from "../lib/cn";
import { getScrollbarOffset, lockBodyScroll } from "../lib/scroll-lock";

type Props = {
  onClose: () => void;
  activePartnershipId: string | null;
};

const ACCOUNT_TYPES: CreateAccountInput["type"][] = [
  "cash",
  "credit",
  "debit",
  "savings",
];

export default function ManageAccountsModal(props: Props) {
  const scrollbarOffset = getScrollbarOffset();
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editName, setEditName] = createSignal("");
  const [editType, setEditType] =
    createSignal<CreateAccountInput["type"]>("cash");
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  let editInputRef: HTMLInputElement | undefined;
  let unlockBodyScroll = () => {};
  const queryClient = useQueryClient();

  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts"],
    queryFn: () => fetchAccounts(null),
  }));

  const meQuery = createQuery(() => ({
    queryKey: ["me"],
    queryFn: fetchMe,
  }));

  const partnershipsQuery = createQuery(() => ({
    queryKey: ["partnerships"],
    queryFn: fetchPartnerships,
    enabled: props.activePartnershipId !== null,
  }));

  const myId = () => meQuery.data?.id ?? "";

  const isGroupContext = () => {
    if (!props.activePartnershipId) return false;
    const p = partnershipsQuery.data?.find(
      (x) => x.id === props.activePartnershipId,
    );
    return p?.type === "group";
  };

  onMount(() => {
    unlockBodyScroll = lockBodyScroll();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingId()) {
          setEditingId(null);
        } else {
          props.onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  onCleanup(() => {
    unlockBodyScroll();
  });

  const updateMutation = createMutation(() => ({
    mutationFn: (vars: { id: string; data: CreateAccountInput }) =>
      updateAccount(vars.id, vars.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setEditingId(null);
    },
  }));

  const deleteMutation = createMutation(() => ({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setDeleteError(null);
    },
    onError: (err: Error) => {
      setDeleteError(err.message);
    },
  }));

  const privacyMutation = createMutation(() => ({
    mutationFn: ({ id, isPrivate }: { id: string; isPrivate: boolean }) =>
      setAccountPrivacy(id, isPrivate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  }));

  const startEdit = (account: Account) => {
    setEditingId(account.id);
    setEditName(account.name);
    setEditType(account.type);
    setDeleteError(null);
    setTimeout(() => editInputRef?.focus(), 0);
  };

  const handleSave = () => {
    const id = editingId();
    if (!id || !editName().trim()) return;
    updateMutation.mutate({
      id,
      data: { name: editName().trim(), type: editType() },
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this account? This cannot be undone.")) return;
    setDeleteError(null);
    deleteMutation.mutate(id);
  };

  // Only show own accounts in manage view
  const ownAccounts = () =>
    (accountsQuery.data ?? []).filter(
      (a) => !a.owner_user_id || a.owner_user_id === myId(),
    );

  return (
    <>
      <div
        class="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={props.onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage accounts"
        class="fixed inset-x-0 bottom-0 z-50 bg-sheet-bg rounded-t-3xl px-6 pt-4 pb-10 sheet-enter max-w-md mx-auto max-h-[80vh] overflow-y-auto"
        style={{ right: `${scrollbarOffset}px` }}
      >
        <div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
        <h2 class="text-white font-semibold text-xl text-center mb-6">
          Manage Accounts
        </h2>

        <Show when={deleteError()}>
          <p class="text-red-400 text-sm text-center mb-4">{deleteError()}</p>
        </Show>

        <div class="space-y-2">
          <For each={ownAccounts()}>
            {(account) => (
              <Show
                when={editingId() === account.id}
                fallback={
                  <div class="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                    <span
                      class={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        account.type === "credit"
                          ? "bg-purple-500"
                          : account.type === "savings"
                            ? "bg-blue-400"
                            : account.type === "debit"
                              ? "bg-pink-500"
                              : "bg-green-400",
                      )}
                    />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-white truncate">
                        {account.name}
                      </p>
                      <p class="text-xs text-gray-500 capitalize">
                        {account.type}
                        {account.is_private && (
                          <span class="ml-1 text-amber-500">· private</span>
                        )}
                      </p>
                    </div>
                    {/* Privacy toggle — only in group context */}
                    <Show when={isGroupContext()}>
                      <button
                        type="button"
                        onClick={() =>
                          privacyMutation.mutate({
                            id: account.id,
                            isPrivate: !account.is_private,
                          })
                        }
                        disabled={privacyMutation.isPending}
                        class={cn(
                          "p-1.5 transition-colors disabled:opacity-50",
                          account.is_private
                            ? "text-amber-400 hover:text-amber-300"
                            : "text-gray-600 hover:text-amber-400",
                        )}
                        aria-label={
                          account.is_private ? "Make public" : "Make private"
                        }
                      >
                        <Show
                          when={account.is_private}
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
                                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
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
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zM10 11V7a2 2 0 114 0v4"
                            />
                          </svg>
                        </Show>
                      </button>
                    </Show>
                    <button
                      type="button"
                      onClick={() => startEdit(account)}
                      class="p-1.5 text-gray-500 hover:text-white transition-colors"
                      aria-label={`Edit ${account.name}`}
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
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(account.id)}
                      disabled={deleteMutation.isPending}
                      class="p-1.5 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      aria-label={`Delete ${account.name}`}
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                }
              >
                {/* Edit mode */}
                <div class="bg-white/5 rounded-xl px-4 py-3 space-y-3">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editName()}
                    onInput={(e) => setEditName(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    class="w-full bg-white/5 rounded-lg px-3 py-2 text-white text-sm placeholder:text-gray-600 outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <div class="flex gap-1.5">
                    <For each={ACCOUNT_TYPES}>
                      {(t) => (
                        <button
                          type="button"
                          onClick={() => setEditType(t)}
                          class={cn(
                            "flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                            editType() === t
                              ? "bg-purple-600 text-white"
                              : "bg-white/5 text-gray-400 hover:bg-white/10",
                          )}
                        >
                          {t}
                        </button>
                      )}
                    </For>
                  </div>
                  <Show when={updateMutation.isError}>
                    <p class="text-red-400 text-xs">
                      Failed to update account.
                    </p>
                  </Show>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      class="flex-1 py-2 rounded-lg bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      class="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {updateMutation.isPending ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </Show>
            )}
          </For>
        </div>

        <button
          type="button"
          onClick={props.onClose}
          class="w-full mt-6 py-3 rounded-xl bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10 transition-colors"
        >
          Close
        </button>
      </div>
    </>
  );
}
