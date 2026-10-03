/**
 * The bots of github.com/meocord/examples a line's Guide shows, as `content/<line>/example-bots.json` lists them:
 * each bot, what it shows, and the Guide pages each of those illustrates. The Example bots page draws a bot with
 * `::example-bot{id="…"}`, and each page a bot illustrates links back to it, both from this one list.
 */

import { existsSync, readFileSync } from 'fs'
import path from 'path'

/** One thing a bot shows: in which of its files, and the Guide pages, `<path>[#anchor]`, that teach it. */
export interface BotFeature {
  what: string
  files: string[]
  guide: string[]
}

/** A bot of the examples repository; its id is its folder there and its section's anchor on the Example bots page. */
export interface ExampleBot {
  id: string
  title: string
  shows: BotFeature[]
}

export interface ExampleBots {
  repository: string
  bots: ExampleBot[]
}

/** The file in a line's Guide folder that lists its example bots. */
export const EXAMPLE_BOTS_FILE = 'example-bots.json'

/** The Guide page that draws every bot, at the anchor of its id. */
export const EXAMPLE_BOTS_PAGE = 'example-bots'

/** A line's example bots, from its Guide folder; undefined when it lists none. */
export function readExampleBots(folder: string): ExampleBots | undefined {
  const file = path.join(folder, EXAMPLE_BOTS_FILE)
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as ExampleBots) : undefined
}

/** A bot's folder on the repository's main branch, or one of its files. */
export const botUrl = (bots: ExampleBots, bot: ExampleBot, file?: string): string =>
  file ? `${bots.repository}/blob/main/${bot.id}/${file}` : `${bots.repository}/tree/main/${bot.id}`

const DIRECTIVE = /^::example-bot\{id="([^"]*)"\}[ \t]*$/gm

/** The ids a page's `::example-bot{id="…"}` directives name, in order. */
export const drawnBots = (body: string): string[] => [...body.matchAll(DIRECTIVE)].map(match => match[1]!)

/** Items as prose: `a`, `a and b`, `a, b and c`. */
const listed = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : (items[0] ?? '')

const fileLinks = (bots: ExampleBots, bot: ExampleBot, files: string[]) =>
  listed(files.map(file => `[\`${path.posix.basename(file)}\`](${botUrl(bots, bot, file)})`))

/**
 * A page's body with each `::example-bot{id="…"}` replaced by a link to its bot's folder on GitHub and a list of
 * what it shows: the files that show each, and the Guide pages that teach it, titled by `titleOf`. A directive
 * naming no bot is left as written.
 */
export function withExampleBots(
  body: string,
  bots: ExampleBots | undefined,
  titleOf: (ref: string) => string | undefined,
): string {
  if (!bots) return body
  return body.replace(DIRECTIVE, (directive, id: string) => {
    const bot = bots.bots.find(candidate => candidate.id === id)
    if (!bot) return directive
    const items = bot.shows.map(feature => {
      const pages = listed(feature.guide.map(ref => `[${titleOf(ref) ?? ref}](guide:${ref})`))
      return `- ${feature.what}, in ${fileLinks(bots, bot, feature.files)}. See ${pages}.`
    })
    return [`[\`${bot.id}/\` on GitHub](${botUrl(bots, bot)})`, '', ...items].join('\n')
  })
}

/**
 * What the bots show that a Guide page teaches, as a Markdown list: each feature that names the page, linking
 * its bot's section on the Example bots page and its files. Undefined when no bot illustrates the page.
 */
export function botsIllustrating(bots: ExampleBots | undefined, pagePath: string): string | undefined {
  const items = (bots?.bots ?? []).flatMap(bot =>
    bot.shows
      .filter(feature => feature.guide.some(ref => ref.split('#')[0] === pagePath))
      .map(feature => {
        const where = `[${bot.title}](guide:${EXAMPLE_BOTS_PAGE}#${bot.id})`
        return `- ${where}: ${feature.what}, in ${fileLinks(bots!, bot, feature.files)}.`
      }),
  )
  return items.length > 0 ? items.join('\n') : undefined
}

const ID = /^[a-z0-9][a-z0-9-]*$/
const REF = /^[a-z0-9][a-z0-9/-]*(?:#[a-z0-9][a-z0-9-]*)?$/

/**
 * Problems with a line's bots: their form, and how the Guide draws them. Each bot is drawn once, by the Example
 * bots page, under a heading of its id, and every directive names one. Its rows' `guide:` links are checked
 * with the rest of that page's links.
 */
export function exampleBotProblems(
  folder: string,
  bots: ExampleBots,
  pages: { pagePath: string; body: string; anchors: Set<string> }[],
): string[] {
  const where = `${folder}/${EXAMPLE_BOTS_FILE}`
  const problems: string[] = []
  if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(bots.repository ?? ''))
    problems.push(`${where}: repository is not a GitHub repository's URL`)
  const ids = new Set<string>()
  for (const bot of bots.bots ?? []) {
    const name = `${where}: bot "${bot.id}"`
    if (!ID.test(bot.id ?? '')) problems.push(`${name}: its id is not a folder name in kebab case`)
    if (ids.has(bot.id)) problems.push(`${name} is listed twice`)
    ids.add(bot.id)
    if (!bot.title?.trim()) problems.push(`${name} has no title`)
    if (!bot.shows?.length) problems.push(`${name} shows nothing`)
    for (const feature of bot.shows ?? []) {
      if (!feature.what?.trim() || feature.what.includes('\n'))
        problems.push(`${name}: "${feature.what}" is not one line of text`)
      if (!feature.files?.length) problems.push(`${name}: "${feature.what}" names no file`)
      for (const file of feature.files ?? [])
        if (path.posix.isAbsolute(file) || file.split('/').includes('..'))
          problems.push(`${name}: ${file} is not a path inside the bot's folder`)
      if (!feature.guide?.length) problems.push(`${name}: "${feature.what}" names no Guide page`)
      for (const ref of feature.guide ?? [])
        if (!REF.test(ref)) problems.push(`${name}: "${ref}" is not a Guide page's path, with an optional #anchor`)
    }
  }

  const drawn = new Map<string, number>()
  for (const { pagePath, body } of pages)
    for (const id of drawnBots(body)) {
      if (pagePath !== EXAMPLE_BOTS_PAGE)
        problems.push(`${folder}/${pagePath}.md: ::example-bot{id="${id}"} belongs on ${EXAMPLE_BOTS_PAGE}`)
      else if (!ids.has(id))
        problems.push(`${folder}/${pagePath}.md: ::example-bot{id="${id}"} names no bot of ${where}`)
      drawn.set(id, (drawn.get(id) ?? 0) + 1)
    }
  const page = pages.find(candidate => candidate.pagePath === EXAMPLE_BOTS_PAGE)
  for (const id of ids) {
    const times = drawn.get(id) ?? 0
    if (times !== 1) problems.push(`${where}: bot "${id}" is drawn ${times} times; ${EXAMPLE_BOTS_PAGE} draws it once`)
    if (page && times > 0 && !page.anchors.has(id))
      problems.push(`${folder}/${EXAMPLE_BOTS_PAGE}.md: no heading has the anchor #${id}, which links bot "${id}"`)
  }
  return problems
}
