import { Button, Code, Div, Figcaption, Figure, For, type NodeInstance, Pre, Span, Svg, SvgPath } from '@meonode/ui'
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

type OtherManager = Exclude<PackageManager, 'npm'>

const COMMANDS: { npm: RegExp; to: Record<OtherManager, string> }[] = [
  // A one-off run, outside any project: a package named with its version, or `create`, which makes the project
  { npm: /^npx (?=\S+@\S|\S+ create\b)/, to: { bun: 'bunx ', pnpm: 'pnpm dlx ', yarn: 'yarn dlx ' } },
  // Anything else runs the project's own install, as npx does, rather than fetching the latest release
  { npm: /^npx /, to: { bun: 'bunx ', pnpm: 'pnpm exec ', yarn: 'yarn ' } },
  {
    npm: /^npm (?:install|i) (?:-D|--save-dev) /,
    to: { bun: 'bun add -d ', pnpm: 'pnpm add -D ', yarn: 'yarn add -D ' },
  },
  { npm: /^npm (?:install|i) /, to: { bun: 'bun add ', pnpm: 'pnpm add ', yarn: 'yarn add ' } },
  { npm: /^npm run /, to: { bun: 'bun run ', pnpm: 'pnpm ', yarn: 'yarn ' } },
  // Exactly what the lockfile names; Yarn's is Yarn 2 and later's, as `yarn dlx` above is
  { npm: /^npm ci$/, to: { bun: 'bun ci', pnpm: 'pnpm install --frozen-lockfile', yarn: 'yarn install --immutable' } },
  // Only the production dependencies, removing development ones an earlier install left, which Bun's install keeps
  {
    npm: /^npm ci --omit=dev$/,
    to: {
      bun: 'bun install --production && bun prune --production',
      pnpm: 'pnpm install --frozen-lockfile --prod',
      yarn: 'yarn workspaces focus --all --production',
    },
  },
  // The project's test script: `bun test` runs Bun's own test runner instead
  { npm: /^npm test$/, to: { bun: 'bun run test', pnpm: 'pnpm test', yarn: 'yarn test' } },
]

/** A command that starts by running a package manager. */
const MANAGER = /^(?:npm|npx|pnpm|yarn|bun|bunx)(?=\s|$)/
/** A package manager run anywhere in a command, as by `sudo`, `env`, `$(…)` or `bash -c "…"`, which no rule converts. */
const MANAGER_ANYWHERE = /(?:^|[\s(`"'])(?:npm|npx|pnpm|yarn|bun|bunx)(?=[\s)`"']|$)/
/** A line's comment, from a `#` at its start or after a blank. */
const COMMENT = /(?:^|\s)#.*$/
/** What ends one command of a line and starts the next, kept by `split`. */
const SEPARATOR = /(\s*(?:&&|\|\||;|\|)\s*)/
/** A command's leading blanks and variable assignments, the command, and its trailing blanks. */
const COMMAND = /^(\s*(?:\w+=\S*\s+)*)(.*?)(\s*)$/

/** Whether a piece of a line opens a quote it doesn't close, as when a split or a comment cut through a string. */
const cutQuote = (text: string) => (text.split('"').length - 1) % 2 === 1 || (text.split("'").length - 1) % 2 === 1

/**
 * The same shell commands for each package manager, when the block runs at least one package manager and
 * every package-manager command in it, chained or not, has an equivalent. Other commands, such as `cd` or
 * `git clone`, and comments stay as written in every tab, a comment aligned to a column staying there.
 * Undefined otherwise, so the block is shown as written: also when a package manager runs other than at the
 * start of a command, or a line naming one has a separator or `#` inside quotes, which this doesn't parse.
 */
export function packageManagerVariants(code: string): Record<PackageManager, string> | undefined {
  const lines = code.split('\n').map(line => {
    const comment = COMMENT.exec(line)
    const body = comment ? line.slice(0, comment.index) : line
    const parts = body.split(SEPARATOR)
    // Odd indexes are the separators `split` kept; a cut quote leaves the line unread when it names a manager
    const unread = parts.some((part, index) => index % 2 === 0 && cutQuote(part)) && MANAGER_ANYWHERE.test(line)
    const commands = parts.map((part, index) => {
      if (index % 2 === 1 || !MANAGER_ANYWHERE.test(part)) return { text: part }
      // COMMAND matches any text: each of its groups may be empty
      const [, before, command, after] = COMMAND.exec(part) as RegExpExecArray & [string, string, string, string]
      const plain = MANAGER.test(command) && !MANAGER_ANYWHERE.test(command.replace(MANAGER, ''))
      return {
        text: part,
        before,
        command,
        after,
        rule: plain ? (COMMANDS.find(rule => rule.npm.test(command)) ?? null) : null,
      }
    })
    // A comment two or more blanks after a command is aligned; its match starts at the blank before `#`
    const column = comment && /\S\s+$/.test(body) ? comment.index + 1 : undefined
    return { commands, comment: comment?.[0] ?? '', column, unread }
  })
  const managed = lines.flatMap(line => line.commands).filter(command => 'rule' in command)
  if (managed.length === 0 || managed.some(command => command.rule === null) || lines.some(line => line.unread))
    return undefined
  const convert = (pm: OtherManager) => {
    const converted = lines.map(({ commands, comment, column }) => ({
      text: commands
        .map(part =>
          'rule' in part && part.rule
            ? part.before + part.command.replace(part.rule.npm, part.rule.to[pm]) + part.after
            : part.text,
        )
        .join(''),
      comment,
      column,
    }))
    // Aligned comments move right together, as far as the longest command needs, so they stay aligned
    const shift = Math.max(
      0,
      ...converted.map(line => (line.column === undefined ? 0 : line.text.trimEnd().length + 1 - line.column)),
    )
    return converted
      .map(({ text, comment, column }) =>
        column === undefined ? text + comment : text.trimEnd().padEnd(column + shift, ' ') + comment.trimStart(),
      )
      .join('\n')
  }
  return { npm: code, bun: convert('bun'), pnpm: convert('pnpm'), yarn: convert('yarn') }
}

// Plain SVG, so the icons add no styled node: the copy sheet, and the tick shown once copied.
const icon = (paths: string[], role: string) =>
  Svg({
    'data-icon': role,
    // Under `props`, so they stay attributes: meonode reads a top-level width or height as CSS, and styles it
    props: { width: 16, height: 16 },
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    children: For(
      paths,
      d => SvgPath({ d }),
      d => d,
    ),
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
    // A key and data attributes; never a focus or a language of its own.
    ...extra,
    // It scrolls sideways, so it takes focus for keyboard readers to scroll it.
    tabIndex: 0,
    'data-language': language,
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
              children: For(
                PACKAGE_MANAGERS,
                pm => Button(pm, { type: 'button', 'data-pm-choice': pm }),
                pm => pm,
              ),
            }),
            copyButton(),
          ],
          { key: 'head' },
        ),
        For(
          PACKAGE_MANAGERS,
          pm => pre(variants[pm], language, { 'data-pm-pane': pm }),
          pm => pm,
        ),
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
