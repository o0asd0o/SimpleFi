/**
 * Creates touch swipe handlers for swipe-to-reveal rows.
 * @param id - The id of the item this row represents
 * @param openId - Accessor returning the currently-open item id (or null)
 * @param setOpenId - Setter to open/close a row by id
 */
export function createSwipeHandlers(
  id: string,
  openId: () => string | null,
  setOpenId: (id: string | null) => void,
) {
  let touchStartX = 0;
  let touchStartY = 0;

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    if (openId() !== null && openId() !== id) setOpenId(null);
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < Math.abs(dy)) return;
    if (dx < -40) setOpenId(id);
    else if (dx > 20 && openId() === id) setOpenId(null);
  };

  return { handleTouchStart, handleTouchEnd };
}
