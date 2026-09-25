/** Checks the repository's content against its rules: `bun run content:check`. Exits 1 on any problem. */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import type { ChangelogDocument } from './lib/changelog.js'
import { checkSite, type SiteSnapshot } from './lib/content.js'
import { paths } from './lib/layout.js'
import { readVersions } from './lib/versions.js'

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

const config = readVersions(paths.versions)
const site: SiteSnapshot = {
  config,
  pages: {},
  readmeAnchors: {},
  migrating: {},
  changelogs: {},
  apis: new Set(),
  examples: {},
}
for (const { line, versions } of config.lines) {
  site.pages[line] = Object.fromEntries(
    Object.entries(filesUnder(paths.content(line)))
      .filter(([file]) => file.endsWith('.md'))
      .map(([file, text]) => [file.replace(/\.md$/, ''), text]),
  )
  const anchors = readIf(paths.readmeAnchors(line))
  if (anchors) site.readmeAnchors[line] = JSON.parse(anchors)
  site.migrating[line] = readIf(paths.migrating(line))
  site.examples[line] = filesUnder(paths.examples(line))
  for (const version of versions) {
    if (existsSync(paths.api(version))) site.apis.add(version)
    const changelog = readIf(paths.changelog(version))
    site.changelogs[version] = changelog ? (JSON.parse(changelog) as ChangelogDocument) : undefined
  }
}

const problems = checkSite(site)
if (problems.length > 0) {
  console.error(`${problems.length} content problem(s):\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(
  `Content is consistent: ${config.lines.length} lines, ${Object.values(site.pages).reduce((sum, pages) => sum + Object.keys(pages).length, 0)} pages.`,
)
