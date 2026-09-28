/** Checks the repository's content against its rules: `bun run content:check`. Exits 1 on any problem. */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import type { ChangelogDocument } from './lib/changelog.js'
import type { ConfigDocument } from './lib/config-reference.js'
import { commentsOf } from './lib/comments.js'
import {
  checkSite,
  EXAMPLE_SOURCE,
  gendered,
  genderedInMarkdown,
  overlongLines,
  PROSE_WIDTH,
  type SiteSnapshot,
} from './lib/content.js'
import { checkGuide, reservedProblems } from './lib/guide.js'
import { markdownAnchors } from './lib/migrating.js'
import { paths, ROOT } from './lib/layout.js'
import { literalCreates, PACKAGE_SPEC } from './lib/package-spec.js'
import { readVersions } from './lib/versions.js'
import { memberAnchor } from '../src/lib/urls'
import { cliManifest, subcommandAnchor } from '../src/lib/docs/cli-site'
import { apiModel } from '../src/lib/docs/api-site.js'

const readIf = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined)

function filesUnder(dir: string, root = dir): Record<string, string> {
  if (!existsSync(dir)) return {}
  const files: Record<string, string> = {}
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) Object.assign(files, filesUnder(full, root))
    else files[path.relative(root, full).split(path.sep).join('/')] = readFileSync(full, 'utf8')
  }
  return files
}

/** The 1-based line of an offset in a text. */
const lineAt = (text: string, offset: number) => text.slice(0, offset).split('\n').length

const config = readVersions(paths.versions)
const site: SiteSnapshot = {
  config,
  authored: {},
  readme: {},
  readmeAnchors: {},
  migrating: {},
  changelogs: {},
  apis: new Set(),
  configs: {},
  examples: {},
  // The site's own model of each API, by entry point as links store it, so a link is checked against its pages
  api: (line, version) => apiModel(line, version, 'entry'),
}
for (const { line, versions } of config.lines) {
  const pagesIn = (dir: string) =>
    Object.fromEntries(
      Object.entries(filesUnder(dir))
        .filter(([file]) => file.endsWith('.md'))
        .map(([file, text]) => [file.replace(/\.md$/, ''), text]),
    )
  site.authored[line] = pagesIn(paths.content(line))
  site.readme[line] = pagesIn(paths.readme(line))
  const anchors = readIf(paths.readmeAnchors(line))
  if (anchors) site.readmeAnchors[line] = JSON.parse(anchors)
  site.migrating[line] = readIf(paths.migrating(line))
  site.examples[line] = filesUnder(paths.examples(line))
  for (const version of versions) {
    if (existsSync(paths.api(version))) site.apis.add(version)
    const reference = readIf(paths.config(version))
    site.configs[version] = reference ? (JSON.parse(reference) as ConfigDocument) : undefined
    const changelog = readIf(paths.changelog(version))
    site.changelogs[version] = changelog ? (JSON.parse(changelog) as ChangelogDocument) : undefined
  }
}

site.examples[EXAMPLE_SOURCE] = filesUnder(paths.examples(EXAMPLE_SOURCE))

const problems = checkSite(site)
// No Guide page may take a path the site routes itself, or will
problems.push(...reservedProblems(ROOT))

// Content says they, them and their: in every Markdown file's prose, and in the examples' comments
for (const [file, text] of Object.entries(filesUnder(path.join(ROOT, 'content'))))
  if (file.endsWith('.md'))
    for (const { line, word } of genderedInMarkdown(text))
      problems.push(`content/${file}:${line}: "${word}" is a gendered pronoun; write they, them or their`)
for (const [file, text] of Object.entries(filesUnder(path.join(ROOT, 'examples'))))
  if (file.endsWith('.ts'))
    for (const comment of commentsOf(text))
      for (const { line, word } of gendered(comment.text, index => lineAt(text, comment.offset + index)))
        problems.push(`examples/${file}:${line}: "${word}" is a gendered pronoun; write they, them or their`)

// A create command installs the line its page documents: {{meocord}}, not a package spec written out.
// Migration guides are left alone, since they name the commands of releases before theirs; imported
// READMEs are written with the placeholder, and `bun run commands:check` checks the built site.
for (const folder of ['content', 'generated/readme'])
  for (const [file, text] of Object.entries(filesUnder(path.join(ROOT, folder))))
    if (file.endsWith('.md') && !file.startsWith('migrating/'))
      for (const { line, command } of literalCreates(text))
        problems.push(
          `${folder}/${file}:${line}: "${command}" names the package itself; write "${PACKAGE_SPEC} create", which installs this line`,
        )

// Prose wraps at PROSE_WIDTH in every Markdown file of content/, the Guide and migration guides included
for (const [file, text] of Object.entries(filesUnder(path.join(ROOT, 'content'))))
  if (file.endsWith('.md'))
    for (const { line, length } of overlongLines(text))
      problems.push(`content/${file}:${line}: a line of ${length} characters; wrap prose at ${PROSE_WIDTH}`)

// A line's Guide in the overhauled template, where one is being written: content/<line>-next/.
let guidePages = 0
let plannedLinks = 0
for (const line of config.lines) {
  const dir = paths.guide(line.line)
  if (!existsSync(dir)) continue
  const files = Object.fromEntries(
    Object.entries(filesUnder(dir))
      .filter(([file]) => file.endsWith('.md'))
      .map(([file, text]) => [file.replace(/\.md$/, ''), text]),
  )
  guidePages += Object.keys(files).length
  // Each symbol by name, as the site renders it: the kinds its @group files it under, and its members
  const model = apiModel(line.line)
  const apiSymbols = new Map<string, { kinds: string[]; members: string[] }>()
  for (const { section, symbol: name } of model?.params() ?? []) {
    const symbol = model!.symbol(section, name)!
    const known = apiSymbols.get(name) ?? { kinds: [], members: [] }
    if (symbol.group) known.kinds.push(symbol.group.toLowerCase())
    // A link names a member as it is written, and goes to its anchor, wherever the page moved it
    known.members.push(...symbol.anchors, ...symbol.members.map(member => memberAnchor(member.name)))
    apiSymbols.set(name, known)
  }
  // The CLI's commands, as the Guide names them: api:cli/<command>[#subcommand]
  for (const command of cliManifest(line.versions.at(-1))?.commands ?? []) {
    const known = apiSymbols.get(command.name) ?? { kinds: [], members: [] }
    known.kinds.push('cli')
    known.members.push(...command.commands.map(subcommandAnchor))
    apiSymbols.set(command.name, known)
  }
  const migrating = site.migrating[line.line]
  const report = checkGuide(files, {
    line: line.line,
    examples: site.examples,
    apiSymbols,
    migratingAnchors: migrating ? new Set(markdownAnchors(migrating)) : undefined,
  })
  problems.push(...report.problems)
  plannedLinks += report.planned.length
}
if (problems.length > 0) {
  console.error(`${problems.length} content problem(s):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
const count = (sets: Record<string, Record<string, string>>) =>
  Object.values(sets).reduce((sum, pages) => sum + Object.keys(pages).length, 0)
console.log(
  `Content is consistent: ${config.lines.length} lines, ${count(site.readme)} imported and ${count(site.authored)} authored pages${guidePages ? `, and ${guidePages} Guide pages, with ${plannedLinks} link(s) to planned pages not written yet` : ''}.`,
)
