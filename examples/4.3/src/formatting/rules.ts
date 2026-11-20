/** The server's rules, longer than one message holds. */
export const RULES = Array.from(
  { length: 40 },
  (_, index) =>
    `${index + 1}. Be kind to other members, keep each channel on its topic, and ask a moderator when unsure.`,
).join('\n')
