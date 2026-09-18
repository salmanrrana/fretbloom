/**
 * Scroll a pane so `target` sits in its upper third — only once it has left
 * view, so a playing song scrolls a "page" at a time with room to read ahead.
 * Scrolls the pane alone, never the document. The pane must be `target`'s
 * offsetParent (position: relative).
 */
export function revealInPane(pane: HTMLElement, target: HTMLElement): void {
  const top = target.offsetTop
  const bottom = top + target.offsetHeight
  if (top >= pane.scrollTop && bottom <= pane.scrollTop + pane.clientHeight)
    return
  pane.scrollTo({
    top: Math.max(0, top - pane.clientHeight / 3),
    behavior: 'smooth',
  })
}
