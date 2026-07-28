import {
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  Show,
  untrack,
  useContext,
  type JSX,
} from "solid-js";

/** Must match the *-exit animation durations in index.css. */
export const EXIT_MS = 250;

const ClosingContext = createContext<() => boolean>(() => false);

/**
 * True while the nearest <Dismissable> ancestor is playing its exit animation.
 * Overlay chrome (SlidePanel, SidebarMenu) reads this to swap enter -> exit
 * classes without every modal in between having to thread a prop through.
 */
export const useClosing = () => useContext(ClosingContext);

/**
 * Drop-in replacement for <Show> around an overlay.
 *
 * <Show> unmounts on the same tick the signal flips, so exit animations never
 * get to run. Dismissable keeps the children mounted for `duration` ms with
 * useClosing() flipped to true, then unmounts.
 *
 * Children must be eagerly imported. The child is created inside a tracked
 * scope below, so a lazy() child subscribes this insert to its own loading
 * signal; resolving the chunk re-runs the insert, which creates another lazy
 * child, forever — the tab freezes instead of opening the overlay.
 */
export default function Dismissable(props: {
  when: boolean;
  /** Override the exit duration. Defaults to EXIT_MS. */
  duration?: number;
  /** Runs after the exit animation finishes and the children unmount. */
  onExited?: () => void;
  /**
   * Plain children read `closing` via useClosing() (see SlidePanel).
   * Inline overlays that render their own chrome can take it as a render prop.
   */
  children: JSX.Element | ((closing: () => boolean) => JSX.Element);
}) {
  const [mounted, setMounted] = createSignal(props.when);
  const [closing, setClosing] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    if (props.when) {
      clearTimeout(timer);
      setClosing(false);
      setMounted(true);
    } else if (untrack(mounted)) {
      setClosing(true);
      timer = setTimeout(() => {
        setMounted(false);
        setClosing(false);
        props.onExited?.();
      }, props.duration ?? EXIT_MS);
    }
  });

  onCleanup(() => clearTimeout(timer));

  return (
    <ClosingContext.Provider value={closing}>
      <Show when={mounted()}>
        {(() => {
          const child = props.children;
          return typeof child === "function" ? child(closing) : child;
        })()}
      </Show>
    </ClosingContext.Provider>
  );
}
