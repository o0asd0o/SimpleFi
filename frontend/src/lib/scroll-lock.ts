let activeScrollLocks = 0;
let previousBodyOverflow = "";

export function getScrollbarOffset() {
  return Math.max(window.innerWidth - document.documentElement.clientWidth, 0);
}

export function lockBodyScroll() {
  if (activeScrollLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  activeScrollLocks += 1;

  return () => {
    activeScrollLocks = Math.max(activeScrollLocks - 1, 0);

    if (activeScrollLocks === 0) {
      document.body.style.overflow = previousBodyOverflow;
    }
  };
}
