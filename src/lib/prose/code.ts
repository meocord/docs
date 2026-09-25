import { Button, Code, Div, Figcaption, Figure, type NodeInstance, Pre, Span, Svg, SvgPath } from '@meonode/ui'
import { highlight } from '@/lib/prose/highlight'
import { LANGUAGES } from '@/lib/prose/languages'

const LANGUAGE_NAMES: Record<string, string> = {
  typescript: 'TypeScript',
  tsx: 'TSX',
  javascript: 'JavaScript',
  json: 'JSON',
  jsonc: 'JSONC',
  bash: 'Shell',
  dotenv: '.env',
  yaml: 'YAML',
  toml: 'TOML',
  docker: 'Dockerfile',
  markdown: 'Markdown',
  html: 'HTML',
  diff: 'Diff',
}

export const PACKAGE_MANAGERS = ['npm', 'bun', 'pnpm', 'yarn'] as const
export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

const COMMANDS: { npm: RegExp; to: Record<Exclude<PackageManager, 'npm'>, string> }[] = [
  { npm: /^npx /, to: { bun: 'bunx ', pnpm: 'pnpm dlx ', yarn: 'yarn dlx ' } },
  {
    npm: /^npm (?:install|i) (?:-D|--save-dev) /,
    to: { bun: 'bun add -d ', pnpm: 'pnpm add -D ', yarn: 'yarn add -D ' },
  },
  { npm: /^npm (?:install|i) /, to: { bun: 'bun add ', pnpm: 'pnpm add ', yarn: 'yarn add ' } },
  { npm: /^npm run /, to: { bun: 'bun run ', pnpm: 'pnpm ', yarn: 'yarn ' } },
]

/**
 * The same shell commands for each package manager, when every command line in the block is an npm or
 * npx one that has an equivalent; undefined otherwise, so the block is shown as written.
 */
export function packageManagerVariants(code: string): Record<PackageManager, string> | undefined {
  const lines = code.split('\n')
  const commands = lines.filter(line => line.trim() && !line.trim().startsWith('#'))
  if (commands.length === 0 || !commands.every(line => COMMANDS.some(rule => rule.npm.test(line)))) return undefined
  const convert = (pm: Exclude<PackageManager, 'npm'>) =>
    lines
      .map(line => {
        const rule = COMMANDS.find(candidate => candidate.npm.test(line))
        return rule ? line.replace(rule.npm, rule.to[pm]) : line
      })
      .join('\n')
  return { npm: code, bun: convert('bun'), pnpm: convert('pnpm'), yarn: convert('yarn') }
}

// Plain SVG, so the icons add no styled node: the copy sheet, and the tick shown once copied.
const icon = (paths: string[], role: string) =>
  Svg({
    'data-icon': role,
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    children: paths.map((d, key) => SvgPath({ key, d })),
  })

function copyButton() {
  return Button(
    [
      icon(
        [
          'M5.5 5.5V3.75A1.25 1.25 0 0 1 6.75 2.5h5.5a1.25 1.25 0 0 1 1.25 1.25v5.5a1.25 1.25 0 0 1-1.25 1.25H10.5',
          'M3.75 5.5h5.5a1.25 1.25 0 0 1 1.25 1.25v5.5a1.25 1.25 0 0 1-1.25 1.25h-5.5a1.25 1.25 0 0 1-1.25-1.25v-5.5A1.25 1.25 0 0 1 3.75 5.5z',
        ],
        'copy',
      ),
      icon(['M3.75 8.5 6.5 11.25l5.75-6.5'], 'copied'),
    ],
    { key: 'copy', type: 'button', 'data-copy': true, 'aria-label': 'Copy code' },
  )
}

function pre(code: string, language: string | undefined, extra: Record<string, unknown> = {}) {
  const html = highlight(code, language)
  return Pre(html ? Code(null, { dangerouslySetInnerHTML: { __html: html } }) : Code(code), {
    // It scrolls sideways, so it takes focus for keyboard readers to scroll it.
    tabIndex: 0,
    'data-language': language,
    ...extra,
  })
}

/**
 * A code block in its frame: a header naming the file, or else the language, with a copy button,
 * above the highlighted code. Install commands get a tab per package manager instead of a name; the
 * pane shown follows `data-pm` on <html>, which the pre-paint script stamps, npm when unset.
 */
export function codeFrame(
  code: string,
  language: string | undefined,
  { key, file }: { key?: number; file?: string } = {},
): NodeInstance {
  const variants = language && /^(sh|shell|bash|zsh)$/i.test(language) ? packageManagerVariants(code) : undefined
  if (variants) {
    return Figure({
      key,
      'data-code': true,
      'data-install': true,
      children: [
        Figcaption(
          [
            Div({
              key: 'tabs',
              role: 'group',
              'aria-label': 'Package manager',
              children: PACKAGE_MANAGERS.map(pm => Button(pm, { key: pm, type: 'button', 'data-pm-choice': pm })),
            }),
            copyButton(),
          ],
          { key: 'head' },
        ),
        ...PACKAGE_MANAGERS.map(pm => pre(variants[pm], language, { key: pm, 'data-pm-pane': pm })),
      ],
    })
  }
  const grammar = language && LANGUAGES[language.toLowerCase()]
  const label = file ?? (grammar ? LANGUAGE_NAMES[grammar] : language)
  return Figure({
    key,
    'data-code': true,
    children: [
      Figcaption([Span(label ?? '', { key: 'label', 'data-file': file ? true : undefined }), copyButton()], {
        key: 'head',
      }),
      pre(code, language, { key: 'code' }),
    ],
  })
}
