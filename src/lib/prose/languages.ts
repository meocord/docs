/**
 * The fence languages the site highlights, by the names content may use, mapped to the grammar that
 * draws them. `text` and an unmarked fence are plain. The content check refuses any other name, so
 * every fence on the site is either coloured or deliberately plain.
 */
export const LANGUAGES: Record<string, string> = {
  ts: 'typescript',
  typescript: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  javascript: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'jsonc',
  sh: 'bash',
  shell: 'bash',
  bash: 'bash',
  zsh: 'bash',
  console: 'bash',
  dotenv: 'dotenv',
  env: 'dotenv',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  dockerfile: 'docker',
  docker: 'docker',
  md: 'markdown',
  markdown: 'markdown',
  html: 'html',
  diff: 'diff',
}

/** Languages drawn as plain text on purpose. */
export const PLAIN_LANGUAGES = ['text', 'txt', 'plaintext']

/** Whether a fence's language is one the site draws, coloured or plain; an unmarked fence is plain. */
export function isKnownLanguage(language: string | undefined): boolean {
  if (!language) return true
  const name = language.toLowerCase()
  return name in LANGUAGES || PLAIN_LANGUAGES.includes(name)
}
