import { type JSX, onCleanup, onMount } from "solid-js";
import { getScrollbarOffset, lockBodyScroll } from "../lib/scroll-lock";
import { createIsDesktop } from "../lib/media";

type Props = {
  onClose: () => void;
  ariaLabel: string;
  /** Panel max-width on desktop side panel. Default "max-w-[480px]" */
  maxWidth?: string;
  /** Z-index layer for the panel. Default z-50 */
  zPanel?: string;
  /** Z-index layer for the backdrop. Default z-40 */
  zBackdrop?: string;
  /** Whether Escape key closes the panel. Default true. Set false for custom Escape handling. */
  escapeClose?: boolean;
  children: (isDesktop: () => boolean) => JSX.Element;
};

export default function SlidePanel(props: Props) {
  const scrollbarOffset = getScrollbarOffset();
  const isDesktop = createIsDesktop();
  let unlockBodyScroll = () => {};

  onMount(() => {
    unlockBodyScroll = lockBodyScroll();
    if (props.escapeClose !== false) {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") props.onClose();
      };
      window.addEventListener("keydown", onKeyDown);
      onCleanup(() => window.removeEventListener("keydown", onKeyDown));
    }
  });

  onCleanup(() => {
    unlockBodyScroll();
  });

  const zPanel = () => props.zPanel ?? "z-50";
  const zBackdrop = () => props.zBackdrop ?? "z-40";
  const maxW = () => props.maxWidth ?? "max-w-[480px]";

  return (
    <>
      {/* Backdrop */}
      <div
        class={`fixed inset-0 bg-overlay backdrop-blur-sm ${zBackdrop()}`}
        onClick={props.onClose}
        aria-hidden="true"
      />

      {/* Panel — bottom sheet on mobile, right side panel on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.ariaLabel}
        class={
          isDesktop()
            ? `fixed inset-y-0 right-0 ${zPanel()} ${maxW()} w-full bg-sheet-bg shadow-2xl panel-enter overflow-y-auto`
            : `fixed inset-x-0 bottom-0 ${zPanel()} bg-sheet-bg rounded-t-3xl sheet-enter max-h-[90vh] overflow-y-auto`
        }
        style={{ right: isDesktop() ? undefined : `${scrollbarOffset}px` }}
      >
        {props.children(isDesktop)}
      </div>
    </>
  );
}
