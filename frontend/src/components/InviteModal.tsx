import { createSignal } from "solid-js";
import { createMutation } from "@tanstack/solid-query";
import { inviteToPartnership } from "../lib/api";

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
    <>
      <div
        class="fixed inset-0 bg-overlay z-40 backdrop-blur-sm"
        onClick={props.onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div class="fixed bottom-0 inset-x-0 z-50 bg-sheet-bg rounded-t-2xl p-6 pb-10 max-w-md mx-auto">
        <div class="w-10 h-1 bg-handle rounded-full mx-auto mb-6" />

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
    </>
  );
}
