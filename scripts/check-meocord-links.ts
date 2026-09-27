/**
 * Checks the docs links a meocord checkout publishes against a docs site: every `https://meocord.dev/docs/…`
 * URL in the places PUBLISHED lists (its source, built declarations, README, changelog, changesets, docs/ and
 * GitHub templates) must answer 200, have the heading it names, and not land on a line's page for a topic it
 * lacks. Run before a release, against the live site, which serves docs main. For docs changes not merged
 * yet, serve their build locally.
 *
 *   bun run links:meocord -- <meocord checkout>
 *   bun run build && PORT=3140 bun run serve   # then add --site http://127.0.0.1:3140
 */
import { linkProblem, publishedLinks } from './lib/meocord-links.js'

const args = process.argv.slice(2)
const siteAt = args.indexOf('--site')
const site = siteAt >= 0 ? args.splice(siteAt, 2)[1] : 'https://meocord.dev'
const [checkout] = args
if (!checkout) {
  console.error('Usage: bun run links:meocord -- <meocord checkout> [--site <origin>]')
  process.exit(2)
}

const links = publishedLinks(checkout)
const problems: string[] = []
for (const [link, files] of links) {
  const response = await fetch(new URL(link.split('#')[0], site))
  const problem = linkProblem(link, response.status, await response.text(), response.url)
  if (problem) problems.push(`${problem} (in ${files.join(', ')})`)
}
if (problems.length > 0) {
  console.error(`${problems.length} of ${links.size} docs link(s) in ${checkout} do not resolve on ${site}:`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`All ${links.size} docs link(s) in ${checkout} resolve on ${site}.`)
