import { createSignal } from "solid-js";
import { clsx as cn } from "clsx";

type PassphraseModalProps = {
  passphrase: string;
  onConfirm: () => void;
};

export default function PassphraseModal(props: PassphraseModalProps) {
  const [copied, setCopied] = createSignal(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(props.passphrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="fixed inset-0 z-50 bg-overlay-heavy flex items-end justify-center">
      <div class="w-full max-w-md bg-sheet-bg border-t border-dim rounded-t-2xl p-6 pb-10 animate-slide-up">
        <h2 class="text-xl font-bold text-fg mb-2">
          Save Your Recovery Passphrase
        </h2>
        <p class="text-sm text-fg-2 mb-6">
          Write this down and keep it safe. This is the only way to recover your
          account if you forget your password. It will not be shown again.
        </p>

        <div class="bg-surface-hover rounded-xl p-4 mb-6">
          <p class="text-lg font-mono text-fg text-center leading-relaxed tracking-wide">
            {props.passphrase}
          </p>
        </div>

        <div class="flex flex-col gap-3">
          <button
            type="button"
            onClick={copyToClipboard}
            class={cn(
              "w-full py-3 rounded-xl font-medium transition-colors border",
              copied()
                ? "border-green-500/30 text-green-400 bg-green-500/10"
                : "border-dim text-fg-2 hover:bg-surface",
            )}
          >
            {copied() ? "Copied!" : "Copy to Clipboard"}
          </button>
          <button
            type="button"
            onClick={props.onConfirm}
            class="w-full py-3 rounded-xl font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors"
          >
            I've Saved It
          </button>
        </div>
      </div>
    </div>
  );
}
