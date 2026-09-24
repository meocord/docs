/**
 * The theme modes, read by both the pre-paint script in the root layout and the provider in Wrapper.
 * One object, so the script never stamps a mode the provider then rejects and rewrites after hydration.
 */
export const themeModes = {
  modes: ['light', 'dark'],
  // What the server renders for everyone, which keeps the document identical and cacheable.
  defaultMode: 'dark',
  defaultPreference: 'system',
  system: { light: 'light', dark: 'dark' },
} as const
