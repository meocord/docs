import { describe, expect, it } from 'vitest'
import { checkGuide, guidePath, readingOrder, type GuideContext, type GuidePage } from './guide'

const context: GuideContext = {
  line: '4.1',
  examples: {
    '4.1': {
      'src/guards/owner.guard.ts': '// #region guard\nexport class OwnerGuard {}\n// #endregion guard\n',
      'src/tutorial/app.ts': '// #region step:guards\nguards: [],\n// #endregion step:guards\n',
    },
    compare: { 'src/discordjs/ping.ts': 'export {}\n' },
  },
  apiSymbols: new Set(['UseGuard', 'Guard']),
}

const check = (files: Record<string, string>, with_: Partial<GuideContext> = {}) =>
  checkGuide(files, { ...context, ...with_ }).problems

interface Fields {
  id?: string
  title?: string
  chapter?: string
  order?: number
  group?: string
  summary?: string
  learn?: string[]
  requires?: string[]
  api?: string[]
}

const yaml = (fields: Fields) =>
  Object.entries(fields)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? `[${value.join(', ')}]` : value}`)
    .join('\n')

const page = (fields: Fields, body: string) => `---\n${yaml(fields)}\n---\n\n${body}`

const chapterBody = (extra = '') =>
  [
    'Guards decide whether a call runs.',
    '## When to use it',
    'When a call needs a check.',
    '## Example',
    '::example{file="guards/owner.guard.ts" region="guard"}',
    '## How it works',
    'It runs before the handler.',
    extra,
    '## Next steps',
    '- [Services](guide:services): where state lives',
  ].join('\n\n')

const guards: Fields = {
  id: 'guards',
  title: 'Guards',
  chapter: 'pipeline',
  order: 2,
  summary: 'Decide whether a call may run.',
  learn: ['Write a guard', 'Attach it'],
  requires: ['services'],
  api: ['decorators/UseGuard'],
}
const services: Fields = { ...guards, id: 'services', title: 'Services', chapter: 'structure', order: 1, requires: [] }

const valid = () => ({ guards: page(guards, chapterBody()), services: page(services, chapterBody()) })

describe('checkGuide', () => {
  it('accepts pages in the template', () => {
    expect(check(valid(), context)).toEqual([])
  })

  it('names what the front matter lacks or gets wrong', () => {
    const problems = check(
      {
        ...valid(),
        guards: page(
          { ...guards, id: 'guard', chapter: 'pipes', order: 0, summary: 'x'.repeat(161), learn: ['One'] },
          chapterBody(),
        ),
        notitle: page({ id: 'notitle', chapter: 'start', order: 1, learn: ['a', 'b'] }, chapterBody()),
      },
      context,
    )
    expect(problems).toEqual([
      'content/4.1-next/guards.md: id "guard" is not the file\'s name',
      'content/4.1-next/guards.md: chapter "pipes" is none of start, interactions, messages, structure, pipeline, testing, shipping, appendix',
      'content/4.1-next/guards.md: order is not a whole number from 1',
      'content/4.1-next/guards.md: the summary is 161 characters, over 160',
      'content/4.1-next/notitle.md: front matter has no title',
      'content/4.1-next/notitle.md: front matter has no summary',
    ])
  })

  it('asks for two to four things to learn, and an api entry as <kind>/<Symbol> of the API', () => {
    const named = check(
      { ...valid(), guards: page({ ...guards, api: ['decorators/UseGuard#guards', 'utilities/Nope'] }, chapterBody()) },
      context,
    )
    expect(named).toEqual(['content/4.1-next/guards.md: api entry "utilities/Nope" names no symbol of the API'])
    const problems = check(
      { ...valid(), guards: page({ ...guards, learn: ['a'], api: ['decorator/UseGuard', 'UseGuard'] }, chapterBody()) },
      context,
    )
    expect(problems).toEqual([
      'content/4.1-next/guards.md: learn has 1 item(s), not two to four',
      'content/4.1-next/guards.md: api entry "decorator/UseGuard" is not <kind>/<Symbol>, with a kind of controllers, decorators, responses, utilities, testing, configuration, cli, types',
      'content/4.1-next/guards.md: api entry "UseGuard" is not <kind>/<Symbol>, with a kind of controllers, decorators, responses, utilities, testing, configuration, cli, types',
    ])
  })

  it('keeps groups to the appendix, where every page has one', () => {
    const problems = check(
      {
        ...valid(),
        guards: page({ ...guards, group: 'recipes' }, chapterBody()),
        faq: page({ id: 'faq', title: 'FAQ', chapter: 'appendix', order: 1, summary: 'Answers.' }, 'Answers.'),
      },
      context,
    )
    expect(problems).toEqual([
      'content/4.1-next/guards.md: only an appendix page has a group',
      'content/4.1-next/faq.md: an appendix page has a group, one of recipes, coming-from, help',
    ])
  })

  it('holds a chapter page to the fixed sections, in order', () => {
    const scrambled = [
      '# Guards',
      '## Example',
      '::example{file="guards/owner.guard.ts"}',
      '## When to use it',
      '## Allowing a call',
      '## How it works',
      '#### Too deep',
      '## Build it',
      '## Gotchas',
      '## Next steps',
    ].join('\n\n')
    expect(check({ ...valid(), guards: page(guards, scrambled) }, context)).toEqual([
      'content/4.1-next/guards.md: the body has an H1; the title is the H1',
      'content/4.1-next/guards.md: a heading is deeper than ###',
      'content/4.1-next/guards.md: the fixed sections run When to use it, Example, How it works, Gotchas, Build it, Next steps',
      'content/4.1-next/guards.md: a topic section sits outside How it works … Gotchas, Build it and Next steps',
      'content/4.1-next/guards.md: Build it comes right before Next steps',
    ])
    // Without Gotchas, a topic section after Next steps is still out of place.
    const trailing =
      chapterBody().replace('## Next steps', '## Build it\n\nGrow the bot.\n\n## Next steps') + '\n\n## Extra'
    expect(check({ ...valid(), guards: page(guards, trailing) }, context)).toEqual([
      'content/4.1-next/guards.md: a topic section sits outside How it works … Gotchas, Build it and Next steps',
    ])
    const missing = check({ ...valid(), guards: page(guards, 'Lead only.\n\n## Example') }, context)
    expect(missing).toContain('content/4.1-next/guards.md: the page has no "## When to use it" section')
    expect(missing).toContain('content/4.1-next/guards.md: the page has no "## Next steps" section')
  })

  it("holds a recipe to a recipe's sections", () => {
    const recipe = {
      id: 'tickets',
      title: 'Tickets',
      chapter: 'appendix',
      group: 'recipes',
      order: 1,
      summary: 'A ticket system.',
    }
    const body = ['Lead.', '## How it works', '## The code', '## Setup', '## Next steps'].join('\n\n')
    expect(check({ ...valid(), tickets: page(recipe, body) }, context)).toEqual([
      'content/4.1-next/tickets.md: a recipe has a "## Variations" section',
      'content/4.1-next/tickets.md: "## Setup" is no recipe section; use ### under one of them',
      "content/4.1-next/tickets.md: a recipe's sections run The code, How it works, Variations, Next steps",
    ])
    // An extra H2 in order is reported once, as the section it is not.
    const extra = ['Lead.', '## The code', '## Setup', '## How it works', '## Variations', '## Next steps'].join('\n\n')
    expect(check({ ...valid(), tickets: page(recipe, extra) }, context)).toEqual([
      'content/4.1-next/tickets.md: "## Setup" is no recipe section; use ### under one of them',
    ])
  })

  it('checks orders within a chapter, and what a page requires', () => {
    const problems = check(
      { ...valid(), cooldowns: page({ ...guards, id: 'cooldowns', requires: ['nothing'] }, chapterBody()) },
      context,
    )
    expect(problems).toEqual([
      "content/4.1-next/cooldowns.md: order 2 is also guards's",
      'content/4.1-next/cooldowns.md: requires "nothing", which is no page',
    ])
  })

  it('resolves guide: and api: links, and turns away links by path', () => {
    const links = [
      '[a](guide:services)',
      '[b](guide:services#how-it-works)',
      '[c](guide:services#no-such)',
      '[d](guide:nothing)',
      '[e](api:decorators/UseGuard)',
      '[f](api:decorators/NoSuch)',
      '[g](api:decorator/UseGuard)',
      '[h](/docs/4.1/guards)',
      '[i](#when-to-use-it)',
      '[j](#nowhere)',
      '[k](https://discord.com/developers/docs/interactions/receiving-and-responding#responding-to-an-interaction)',
    ].join(' ')
    expect(check({ ...valid(), guards: page(guards, chapterBody(links)) }, context)).toEqual([
      'content/4.1-next/guards.md: guide:services#no-such names no heading of that page',
      'content/4.1-next/guards.md: guide:nothing names no Guide page',
      'content/4.1-next/guards.md: api:decorators/NoSuch names no symbol of the API',
      'content/4.1-next/guards.md: api:decorator/UseGuard is not api:<kind>/<Symbol>',
      'content/4.1-next/guards.md: /docs/4.1/guards links a page by path; write guide:<id> or api:<kind>/<Symbol>',
      'content/4.1-next/guards.md: no heading for #nowhere',
    ])
  })

  it('counts a link to a planned page not written yet, and fails it once the Guide is complete', () => {
    const body = chapterBody('[a](guide:slash-commands) [b](guide:slash-commands#options) [c](guide:recipes/tickets)')
    const files = { ...valid(), guards: page({ ...guards, requires: ['services', 'first-command'] }, body) }
    expect(checkGuide(files, context)).toEqual({
      problems: [],
      planned: [
        'content/4.1-next/guards.md: requires "first-command"',
        'content/4.1-next/guards.md: guide:slash-commands',
        'content/4.1-next/guards.md: guide:slash-commands#options',
        'content/4.1-next/guards.md: guide:recipes/tickets',
      ],
    })
    expect(checkGuide(files, { ...context, complete: true }).problems).toEqual([
      'content/4.1-next/guards.md: requires "first-command", which is no page',
      'content/4.1-next/guards.md: guide:slash-commands names no Guide page',
      'content/4.1-next/guards.md: guide:slash-commands#options names no Guide page',
      'content/4.1-next/guards.md: guide:recipes/tickets names no Guide page',
    ])
  })

  it("holds every page to the Guide's plan", () => {
    const extra = { ...guards, id: 'extras', title: 'Extras', order: 3 }
    expect(check({ ...valid(), extras: page(extra, chapterBody()) })).toEqual([
      "content/4.1-next/extras.md: extras is not a page of the Guide's plan",
    ])
  })

  it('links the migration guide by guide:migrating, checking its heading, and never on GitHub', () => {
    const github = 'https://github.com/meocord/meocord/blob/main/docs/MIGRATING.md'
    const body = chapterBody(
      `[a](guide:migrating#start) [b](guide:migrating#nope) [c](guide:changelog) [d](${github}#start)`,
    )
    expect(check({ ...valid(), guards: page(guards, body) }, { migratingAnchors: new Set(['start']) })).toEqual([
      'content/4.1-next/guards.md: guide:migrating#nope names no heading of the migration guide',
      `content/4.1-next/guards.md: ${github}#start links the migration guide on GitHub; write guide:migrating#start`,
    ])
  })

  it('takes NOTE, TIP and WARNING callouts, one to a section', () => {
    const body = chapterBody(
      ['> [!NOTE]\n> One.', '> [!WARNING]\n> Two.', '> [!CAUTION]\n> Three.', '```text\n> [!IMPORTANT]\n```'].join(
        '\n\n',
      ),
    )
    expect(check({ ...valid(), guards: page(guards, body) })).toEqual([
      'content/4.1-next/guards.md: "How it works" has more than one callout',
      "content/4.1-next/guards.md: a [!CAUTION] callout; a page's callouts are NOTE, TIP and WARNING",
    ])
  })

  it('reads examples from the line or compare, step regions included, and keeps TypeScript out of fences', () => {
    const body = chapterBody(
      [
        '::example{file="tutorial/app.ts" region="step:guards"}',
        '::example{file="discordjs/ping.ts" from="compare"}',
        '::example{file="missing.ts"}',
        '::example{file="guards/owner.guard.ts" region="nope"}',
        '::example{file="x.ts" from="4.0"}',
        '::example{region="guard"}',
        '```ts\nconst a = 1\n```',
        '```cobol\nX\n```',
        '```diff\n+ a\n```',
        '```bash\nbun run dev\n```',
        '::example{file="missing.ts"}',
      ].join('\n\n'),
    )
    expect(check({ ...valid(), guards: page(guards, body) }, context)).toEqual([
      'content/4.1-next/guards.md: a code fence is marked "cobol"; a page\'s fences are bash, json, yaml, text',
      'content/4.1-next/guards.md: a code fence is marked "diff"; a page\'s fences are bash, json, yaml, text',
      'content/4.1-next/guards.md: TypeScript belongs in examples/4.1 and an ::example directive, not a code fence',
      'content/4.1-next/guards.md: examples/4.1/src/missing.ts does not exist',
      'content/4.1-next/guards.md: examples/4.1/src/guards/owner.guard.ts has no region "nope"',
      'content/4.1-next/guards.md: an ::example reads from "4.0", but only "compare" can be named',
      'content/4.1-next/guards.md: an ::example names no file',
    ])
  })
})

describe('reading order', () => {
  const entry = (id: string, chapter: GuidePage['chapter'], order: number, group?: GuidePage['group']): GuidePage => ({
    id,
    title: id,
    chapter,
    order,
    group,
    summary: '',
    learn: [],
    requires: [],
    api: [],
    formerly: [],
  })

  it('runs chapter by chapter, then by order, with the appendix groups last', () => {
    const pages = [
      entry('faq', 'appendix', 1, 'help'),
      entry('guards', 'pipeline', 2),
      entry('tickets', 'appendix', 1, 'recipes'),
      entry('overview', 'start', 1),
      entry('how-a-call-runs', 'pipeline', 1),
    ]
    expect(readingOrder(pages).map(page => page.id)).toEqual([
      'overview',
      'how-a-call-runs',
      'guards',
      'tickets',
      'faq',
    ])
  })

  it('puts recipes and coming-from pages under their group in the URL', () => {
    expect(guidePath(entry('tickets', 'appendix', 1, 'recipes'))).toBe('recipes/tickets')
    expect(guidePath(entry('discordjs', 'appendix', 1, 'coming-from'))).toBe('coming-from/discordjs')
    expect(guidePath(entry('faq', 'appendix', 1, 'help'))).toBe('faq')
    expect(guidePath(entry('guards', 'pipeline', 2))).toBe('guards')
  })
})
