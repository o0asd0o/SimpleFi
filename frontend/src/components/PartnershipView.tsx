import { createSignal, For, Match, Show, Switch } from "solid-js";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { clsx as cn } from "clsx";
import {
  fetchPartnerships,
  fetchInvitations,
  fetchSentInvitations,
  fetchMe,
  createPartnership,
  leavePartnership,
  respondToInvitation,
} from "../lib/api";
import InviteModal from "./InviteModal";

export default function PartnershipView() {
  const queryClient = useQueryClient();

  const partnershipsQuery = createQuery(() => ({
    queryKey: ["partnerships"],
    queryFn: fetchPartnerships,
  }));

  const invitationsQuery = createQuery(() => ({
    queryKey: ["invitations"],
    queryFn: fetchInvitations,
    refetchInterval: 30000,
  }));

  const sentQuery = createQuery(() => ({
    queryKey: ["invitations", "sent"],
    queryFn: fetchSentInvitations,
    refetchInterval: 30000,
  }));

  const meQuery = createQuery(() => ({
    queryKey: ["me"],
    queryFn: fetchMe,
  }));

  // Create partnership form state
  const [showCreate, setShowCreate] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newType, setNewType] = createSignal<"couple" | "group">("group");
  const [createError, setCreateError] = createSignal("");

  // Invite modal state
  const [invitePartnershipId, setInvitePartnershipId] = createSignal<
    string | null
  >(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["partnerships"] });
    queryClient.invalidateQueries({ queryKey: ["invitations"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["transactions-summary"] });
  };

  const createMut = createMutation(() => ({
    mutationFn: () => createPartnership(newName() || newType(), newType()),
    onSuccess: () => {
      setShowCreate(false);
      setNewName("");
      setCreateError("");
      invalidateAll();
    },
    onError: (e: Error) => setCreateError(e.message),
  }));

  const leaveMut = createMutation(() => ({
    mutationFn: (id: string) => leavePartnership(id),
    onSuccess: () => invalidateAll(),
  }));

  const respondMut = createMutation(() => ({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondToInvitation(id, accept),
    onSuccess: () => invalidateAll(),
  }));

  const partnerships = () => partnershipsQuery.data ?? [];
  const invitations = () => invitationsQuery.data ?? [];
  const sentInvitations = () => sentQuery.data ?? [];
  const myId = () => meQuery.data?.id ?? "";

  const hasCouple = () => partnerships().some((p) => p.type === "couple");

  const partnerName = (pId: string) => {
    const p = partnerships().find((x) => x.id === pId);
    if (!p) return "";
    return (
      p.members.find((m) => m.user_id !== myId() && m.status === "active")
        ?.name ?? ""
    );
  };

  return (
    <div class="px-6 pb-8 space-y-6">
      {/* Pending invitations */}
      <Show when={invitations().length > 0}>
        <section>
          <h2 class="text-xs text-gray-500 uppercase tracking-widest mb-3">
            Pending Invitations
          </h2>
          <div class="space-y-2">
            <For each={invitations()}>
              {(inv) => (
                <div class="bg-white/5 rounded-xl p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-medium text-white">
                        <span class="text-purple-400">{inv.from_name}</span>{" "}
                        invited you to{" "}
                        <span
                          class={cn(
                            "font-semibold",
                            inv.partnership_type === "couple"
                              ? "text-pink-300"
                              : "text-purple-300",
                          )}
                        >
                          {inv.partnership_type === "couple" ? "♥ " : ""}
                          {inv.partnership_name}
                        </span>
                      </p>
                      <p class="text-xs text-gray-500 mt-0.5 capitalize">
                        {inv.partnership_type}
                      </p>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                      <button
                        type="button"
                        disabled={respondMut.isPending}
                        onClick={() =>
                          respondMut.mutate({ id: inv.id, accept: true })
                        }
                        class="px-3 py-1.5 text-xs rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={respondMut.isPending}
                        onClick={() =>
                          respondMut.mutate({ id: inv.id, accept: false })
                        }
                        class="px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-gray-300 font-medium transition-colors disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>

      {/* Partnerships list */}
      <section>
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-xs text-gray-500 uppercase tracking-widest">
            Your Partnerships
          </h2>
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setCreateError("");
            }}
            class="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            + New
          </button>
        </div>

        {/* Create form */}
        <Show when={showCreate()}>
          <div class="bg-white/5 rounded-xl p-4 mb-3 space-y-3">
            <input
              type="text"
              placeholder="Partnership name (optional)"
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              class="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-purple-500"
            />
            <div class="flex gap-2">
              <button
                type="button"
                onClick={() => setNewType("group")}
                class={cn(
                  "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
                  newType() === "group"
                    ? "bg-purple-600 text-white"
                    : "bg-white/10 text-gray-400 hover:text-white",
                )}
              >
                Group
              </button>
              <button
                type="button"
                disabled={hasCouple()}
                onClick={() => setNewType("couple")}
                class={cn(
                  "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
                  newType() === "couple"
                    ? "bg-pink-600 text-white"
                    : "bg-white/10 text-gray-400 hover:text-white",
                  hasCouple() && "opacity-40 cursor-not-allowed",
                )}
              >
                ♥ Couple
              </button>
            </div>
            <Show when={hasCouple() && newType() === "couple"}>
              <p class="text-xs text-amber-400">
                You already have a couple partnership.
              </p>
            </Show>
            <Show when={createError()}>
              <p class="text-xs text-red-400">{createError()}</p>
            </Show>
            <div class="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setCreateError("");
                }}
                class="flex-1 py-2 rounded-lg text-xs font-medium bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  createMut.isPending || (newType() === "couple" && hasCouple())
                }
                onClick={() => createMut.mutate()}
                class="flex-1 py-2 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50"
              >
                {createMut.isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </Show>

        <Switch>
          <Match when={partnershipsQuery.isPending}>
            <p class="text-gray-500 text-sm text-center py-4">Loading…</p>
          </Match>
          <Match when={partnerships().length === 0}>
            <div class="text-center py-8 text-gray-500">
              <p class="text-sm">No partnerships yet.</p>
              <p class="text-xs mt-1">
                Create one and invite someone to get started.
              </p>
            </div>
          </Match>
          <Match when={partnerships().length > 0}>
            <div class="space-y-3">
              <For each={partnerships()}>
                {(p) => (
                  <div class="bg-white/5 rounded-xl p-4 space-y-3">
                    {/* Header */}
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="flex items-center gap-2">
                          <h3 class="text-sm font-semibold text-white">
                            {p.type === "couple" && (
                              <span class="text-pink-400 mr-1">♥</span>
                            )}
                            {p.type === "couple"
                              ? partnerName(p.id) || p.name
                              : p.name}
                          </h3>
                          <span
                            class={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              p.type === "couple"
                                ? "bg-pink-500/15 text-pink-300"
                                : "bg-purple-500/15 text-purple-300",
                            )}
                          >
                            {p.type}
                          </span>
                        </div>
                      </div>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setInvitePartnershipId(p.id)}
                          class="text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          Invite
                        </button>
                        <button
                          type="button"
                          disabled={leaveMut.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Leave "${p.name}"? Your data remains visible to other members.`,
                              )
                            ) {
                              leaveMut.mutate(p.id);
                            }
                          }}
                          class="text-xs text-gray-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                          Leave
                        </button>
                      </div>
                    </div>

                    {/* Members */}
                    <div class="space-y-1.5">
                      <For each={p.members}>
                        {(m) => (
                          <div class="flex items-center gap-2">
                            <div
                              class={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                m.user_id === myId()
                                  ? "bg-purple-600/30 text-purple-300"
                                  : "bg-white/10 text-gray-300",
                              )}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <span class="text-sm text-gray-300">{m.name}</span>
                            <span class="text-xs text-gray-600">
                              @{m.username}
                            </span>
                            <Show when={m.user_id === myId()}>
                              <span class="text-xs text-purple-500 ml-auto">
                                you
                              </span>
                            </Show>
                            <Show when={m.status === "left"}>
                              <span class="text-xs text-gray-600 ml-auto italic">
                                left
                              </span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Match>
        </Switch>
      </section>

      {/* Sent invitations */}
      <Show when={sentInvitations().length > 0}>
        <section>
          <h2 class="text-xs text-gray-500 uppercase tracking-widest mb-3">
            Sent Invitations
          </h2>
          <div class="space-y-2">
            <For each={sentInvitations()}>
              {(inv) => (
                <div class="bg-white/5 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p class="text-sm text-gray-300">
                      Invited <span class="text-white">{inv.to_name}</span>
                    </p>
                    <p class="text-xs text-gray-600">
                      to {inv.partnership_name}
                    </p>
                  </div>
                  <span class="text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    pending
                  </span>
                </div>
              )}
            </For>
          </div>
        </section>
      </Show>

      {/* Invite modal */}
      <Show when={invitePartnershipId() !== null}>
        <InviteModal
          partnershipId={invitePartnershipId()!}
          onClose={() => setInvitePartnershipId(null)}
          onSuccess={() => {
            setInvitePartnershipId(null);
            queryClient.invalidateQueries({
              queryKey: ["invitations", "sent"],
            });
          }}
        />
      </Show>
    </div>
  );
}
