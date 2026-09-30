/** Text as HTML shows it: the characters markup would read as its own escaped. */
export const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Text as a double-quoted HTML attribute's value. */
export const escapeAttribute = (text: string) => escapeHtml(text).replace(/"/g, '&quot;')
