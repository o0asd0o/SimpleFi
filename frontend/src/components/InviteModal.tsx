import { createSignal, Show } from "solid-js";
import { createMutation } from "@tanstack/solid-query";
import { inviteToPartnership } from "../lib/api";
import SlidePanel from "./SlidePanel";

type Props = {
  partnershipId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function InviteModal(props: Props) {
  const [username, setUsername] = createSignal("");
  const [error, setError] = createSignal("");

  const inviteMut = createMutation(() => ({
    mutationFn: () =>
      inviteToPartnership(props.partnershipId, username().trim()),
    onSuccess: () => {
      setUsername("");
      setError("");
      props.onSuccess();
    },
    onError: (e: Error) => setError(e.message),
  }));

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!username().trim()) return;
    setError("");
    inviteMut.mutate();
  };

  return (
    <SlidePanel
      onClose={props.onClose}
      ariaLabel="Invite someone"
      maxWidth="max-w-md"
    >
      {(isDesktop) => (
        <div class="p-6 pb-safe-sheet">
          <Show when={!isDesktop()}>
            <div class="w-10 h-1 bg-handle rounded-full mx-auto mb-6" />
          </Show>

          <h2 class="text-base font-semibold text-fg mb-4">Invite someone</h2>

          <form onSubmit={handleSubmit} class="space-y-3">
            <input
              type="text"
              placeholder="Username"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              autofocus
              class="w-full bg-surface-hover rounded-xl px-4 py-3 text-sm text-fg placeholder:text-fg-3 outline-none focus:ring-1 focus:ring-purple-500"
            />

            {error() && <p class="text-xs text-red-400">{error()}</p>}

            <div class="flex gap-3 pt-1">
              <button
                type="button"
                onClick={props.onClose}
                class="flex-1 py-3 rounded-xl text-sm font-medium bg-surface-hover text-fg-2 hover:text-fg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviteMut.isPending || !username().trim()}
                class="flex-1 py-3 rounded-xl text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50"
              >
                {inviteMut.isPending ? "Sending…" : "Send Invite"}
              </button>
            </div>
          </form>
        </div>
      )}
    </SlidePanel>
  );
}
