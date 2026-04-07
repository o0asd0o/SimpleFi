import { createSignal, For, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { fetchAccounts, fetchMe } from "../lib/api";
import { clsx as cn } from "clsx";
import AccountModal from "./AccountModal";
import ManageAccountsModal from "./ManageAccountsModal";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    n,
  );

type Props = {
  activePartnershipId: string | null;
  onPayCredit: (accountId: string) => void;
};

export default function AccountStrip(props: Props) {
  const [isModalOpen, setIsModalOpen] = createSignal(false);
  const [isManageOpen, setIsManageOpen] = createSignal(false);

  const meQuery = createQuery(() => ({
    queryKey: ["me"],
    queryFn: fetchMe,
  }));

  const accountsQuery = createQuery(() => ({
    queryKey: ["accounts", props.activePartnershipId],
    queryFn: () => fetchAccounts(props.activePartnershipId),
  }));

  const myId = () => meQuery.data?.id ?? "";

  return (
    <div class="mb-4">
      <div class="flex items-center justify-between px-6 mb-2">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium tracking-widest text-gray-500 uppercase">
            Accounts
          </span>
          <button
            type="button"
            onClick={() => setIsManageOpen(true)}
            class="text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Manage accounts"
          >
            <svg
              class="w-3.5 h-3.5"
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
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          class="text-purple-400 text-xs font-medium hover:text-purple-300 transition-colors"
        >
          + Add account
        </button>
      </div>

      <div class="flex gap-2 overflow-x-auto px-6 pb-1 scrollbar-none">
        <For each={accountsQuery.data ?? []}>
          {(account) => (
            <div
              class={cn(
                "flex-shrink-0 bg-white/5 rounded-xl px-4 py-2.5",
                account.type === "credit" &&
                  "cursor-pointer hover:bg-white/10 active:scale-95 transition-all",
              )}
              onClick={() => {
                if (account.type === "credit") props.onPayCredit(account.id);
              }}
            >
              <Show
                when={account.owner_user_id && account.owner_user_id !== myId()}
              >
                <p class="text-xs text-pink-400/80 mb-0.5">
                  {account.owner_name}
                </p>
              </Show>
              <p class="text-xs text-gray-500 capitalize">{account.type}</p>
              <p class="text-sm font-medium text-white">{account.name}</p>
              <p
                class={cn(
                  "text-xs tabular-nums mt-0.5",
                  account.type === "credit"
                    ? "text-purple-400"
                    : "text-gray-400",
                )}
              >
                {account.type === "credit" ? "-" : ""}
                {fmt(Math.abs(account.balance))}
              </p>
            </div>
          )}
        </For>
      </div>

      <Show when={isModalOpen()}>
        <AccountModal onClose={() => setIsModalOpen(false)} />
      </Show>

      <Show when={isManageOpen()}>
        <ManageAccountsModal
          activePartnershipId={props.activePartnershipId}
          onClose={() => setIsManageOpen(false)}
        />
      </Show>
    </div>
  );
}
