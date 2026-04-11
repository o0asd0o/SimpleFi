import { createSignal, onCleanup, onMount } from "solid-js";

/**
 * Reactive signal that tracks whether the viewport is >= 768px (md breakpoint).
 * Returns a getter that updates live on resize.
 */
export function createIsDesktop() {
  const query = "(min-width: 768px)";
  const mql = window.matchMedia(query);
  const [isDesktop, setIsDesktop] = createSignal(mql.matches);

  const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
  mql.addEventListener("change", handler);
  onCleanup(() => mql.removeEventListener("change", handler));

  return isDesktop;
}
