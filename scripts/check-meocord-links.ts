/**
 * Checks the docs links in a meocord checkout against a docs site: every
 * `https://meocord.dev/docs/…` URL in its src/ and, when built, dist/types/ must answer 200, have the
 * heading it names, and not land on a line's page for a topic it lacks. Run before a release, against
 * the site as it will be: the live one, or, before it is up, a build of docs main served locally.
 *
 *   bun run links:meocord -- <meocord checkout> [--site https://meocord.dev]
 *   bun run build && PORT=3140 bun run serve   # then --site http://127.0.0.1:3140
 */
import path from 'path'
import { docsLinks, linkProblem, textsUnder } from './lib/meocord-links.js'

const args = process.argv.slice(2)
const siteAt = args.indexOf('--site')
const site = siteAt >= 0 ? args.splice(siteAt, 2)[1] : 'https://meocord.dev'
const [checkout] = args
if (!checkout) {
  console.error('Usage: bun run links:meocord -- <meocord checkout> [--site <origin>]')
  process.exit(2)
}

const texts = [
  ...textsUnder(path.join(checkout, 'src'), ['.ts']),
  ...textsUnder(path.join(checkout, 'dist', 'types'), ['.d.ts', '.d.cts']),
]
const links = docsLinks(texts)
const problems: string[] = []
for (const link of links) {
  const response = await fetch(new URL(link.split('#')[0], site))
  const problem = linkProblem(link, response.status, await response.text(), response.url)
  if (problem) problems.push(problem)
}
if (problems.length > 0) {
  console.error(`${problems.length} of ${links.length} docs link(s) in ${checkout} do not resolve on ${site}:`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`All ${links.length} docs link(s) in ${checkout} resolve on ${site}.`)
