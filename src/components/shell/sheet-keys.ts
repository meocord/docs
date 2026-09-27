/**
 * Makes the page keys scroll the reading sheet where it is the window's scroller, on a desktop. A key
 * that would scroll the page scrolls the sheet and hands it focus, so the next key scrolls it natively.
 * It runs as an inline script from the first paint, so no key waits for the app's scripts to load.
 */
function sheetKeys() {
  // Where each key moves the sheet to, from where it is.
  const moves: Record<string, (sheet: HTMLElement, shift: boolean) => number> = {
    ' ': (sheet, shift) => sheet.scrollTop + (shift ? -1 : 1) * sheet.clientHeight * 0.85,
    PageDown: sheet => sheet.scrollTop + sheet.clientHeight * 0.85,
    PageUp: sheet => sheet.scrollTop - sheet.clientHeight * 0.85,
    ArrowDown: sheet => sheet.scrollTop + 40,
    ArrowUp: sheet => sheet.scrollTop - 40,
    Home: () => 0,
    End: sheet => sheet.scrollHeight,
  }
  // On the window, so it hears a key after the page's own handlers and leaves one they took.
  window.addEventListener('keydown', event => {
    const move = moves[event.key]
    if (!move || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.target !== document.body) return
    // The page on show: Next keeps a page it navigated away from, hidden, beside it.
    const sheet = Array.from(document.querySelectorAll<HTMLElement>('[data-sheet]')).find(el => el.checkVisibility())
    if (!sheet || getComputedStyle(sheet).overflowY !== 'auto') return
    event.preventDefault()
    sheet.focus({ preventScroll: true })
    sheet.scrollTo({ top: move(sheet, event.shiftKey), behavior: 'auto' })
  })
}

/** The inline script that runs {@link sheetKeys}; it holds no reference outside the function. */
export const SHEET_KEYS_SCRIPT = `(${sheetKeys.toString()})()`
