import { For, Show } from "solid-js";
import { createQuery } from "@tanstack/solid-query";
import { clsx as cn } from "clsx";
import { fetchPartnerships, fetchMe } from "../lib/api";

type Props = {
  activePartnershipId: string | null;
  onChange: (id: string | null) => void;
};

export default function ContextSwitcher(props: Props) {
  const partnershipsQuery = createQuery(() => ({
    queryKey: ["partnerships"],
    queryFn: fetchPartnerships,
  }));

  const meQuery = createQuery(() => ({
    queryKey: ["me"],
    queryFn: fetchMe,
  }));

  const partnerships = () => partnershipsQuery.data ?? [];
  const myId = () => meQuery.data?.id ?? "";

  const partnerNameForCouple = (pId: string) => {
    const p = partnerships().find((x) => x.id === pId);
    if (!p) return "Partner";
    const partner = p.members.find(
      (m) => m.user_id !== myId() && m.status === "active",
    );
    return partner?.name ?? p.name;
  };

  return (
    <Show when={partnerships().length > 0}>
      <div class="px-6 pb-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
        {/* Personal pill */}
        <button
          type="button"
          onClick={() => props.onChange(null)}
          class={cn(
            "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
            props.activePartnershipId === null
              ? "bg-white/15 text-white"
              : "text-gray-500 hover:text-gray-300",
          )}
        >
          Personal
        </button>

        {/* Partnership pills */}
        <For each={partnerships()}>
          {(p) => {
            const isActive = () => props.activePartnershipId === p.id;

            return (
              <button
                type="button"
                onClick={() => props.onChange(p.id)}
                class={cn(
                  "flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  p.type === "couple"
                    ? isActive()
                      ? "bg-pink-500/20 text-pink-300"
                      : "text-gray-500 hover:text-pink-300"
                    : isActive()
                      ? "bg-purple-600/20 text-purple-300"
                      : "text-gray-500 hover:text-gray-300",
                )}
              >
                <Show when={p.type === "couple"}>
                  <span class="text-pink-400">♥</span>
                </Show>
                <span>
                  {p.type === "couple" ? partnerNameForCouple(p.id) : p.name}
                </span>
              </button>
            );
          }}
        </For>
      </div>
    </Show>
  );
}
