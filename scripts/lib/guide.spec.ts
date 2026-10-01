import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkGuide,
  GUIDE_PLAN,
  guidePath,
  counterpartIn,
  guideRendered,
  pageKnownAs,
  readingOrder,
  reservedProblems,
  routedSlugs,
  unembeddedRegions,
  type GuideContext,
  type GuidePage,
} from './guide'

const context: GuideContext = {
  line: '4.1',
  examples: {
    '4.1': {
      'src/guards/owner.guard.ts': '// #region guard\nexport class OwnerGuard {}\n// #endregion guard\n',
      'src/tutorial/app.ts': '// #region step:guards\nguards: [],\n// #endregion step:guards\n',
      'src/button/counter.ts':
        "import { Command, Controller } from 'meocord/decorator'\n// #region count\nexport class Counter {}\n// #endregion count\n",
      'src/button/uses-service.ts':
        "import { Greeter } from '../services/greeter'\nimport type { X } from './x'\nexport {}\n",
    },
    compare: { 'src/discordjs/ping.ts': 'export {}\n' },
  },
  apiSymbols: new Map([
    ['UseGuard', { kinds: ['decorators'], members: ['guards'] }],
    ['Guard', { kinds: [], members: [] }],
  ]),
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
  formerly?: string[]
  covers?: string[]
  terms?: boolean | string
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

  it('refuses an old slug that is no slug, is a Guide path, or is claimed twice', () => {
    const problems = check({
      guards: page({ ...guards, formerly: ['only-staff', 'services', 'Old_Page'] }, chapterBody()),
      services: page({ ...services, formerly: ['only-staff', 'recipes'] }, chapterBody()),
    })
    expect(problems).toEqual([
      'content/4.1/guards.md: formerly "services" is a path the Guide takes',
      'content/4.1/guards.md: formerly "Old_Page" is not a page slug',
      'content/4.1: formerly "only-staff" is claimed by guards and services; one page only',
      'content/4.1/services.md: formerly "recipes" is a path the Guide takes',
    ])
  })

  it("checks what each covered page names: another line's page or heading, or a retired page of its own", () => {
    const coverable = {
      lines: ['4.0', '4.1'],
      pages: { '4.0': { configuration: ['eslint'], 'command-types': [] }, '4.1': {} },
      deployed: { '4.0': [], '4.1': ['interaction-responses', 'guards'] },
    }
    const problems = check(
      {
        guards: page(
          { ...guards, covers: ['4.1/guards', '4.0/command-types', '4.1/interaction-responses'] },
          chapterBody(),
        ),
        services: page(
          {
            ...services,
            covers: [
              'command-types',
              '3.9/guards',
              '4.0/no-such-page',
              '4.0/configuration#nope',
              '4.0/configuration#eslint',
              '4.1/guards',
            ],
          },
          chapterBody(),
        ),
      },
      { coverable },
    )
    expect(problems.filter(problem => problem.includes('covers'))).toEqual([
      'content/4.1/guards.md: covers "4.1/guards" is the page itself',
      'content/4.1/services.md: covers "command-types" is not <line>/<id>, with an optional #anchor',
      'content/4.1/services.md: covers "3.9/guards" names a line versions.json doesn\'t list',
      'content/4.1/services.md: covers "4.0/no-such-page" names no page of 4.0',
      'content/4.1/services.md: covers "4.0/configuration#nope" names no heading of that page',
      'content/4.1/services.md: covers "4.1/guards" is a current page of this line, where only a retired one can be covered',
    ])
    // A retired id of this line that was never deployed
    expect(
      check({ guards: page({ ...guards, covers: ['4.1/never-served'] }, chapterBody()) }, { coverable }).filter(
        problem => problem.includes('covers'),
      ),
    ).toEqual(['content/4.1/guards.md: covers "4.1/never-served" names no page this line\'s deployed site served'])
  })

  it('lets one page only claim a retired page of its own line', () => {
    const coverable = { lines: ['4.1'], pages: { '4.1': {} }, deployed: { '4.1': ['interaction-responses'] } }
    const problems = check(
      {
        guards: page({ ...guards, covers: ['4.1/interaction-responses'] }, chapterBody()),
        services: page({ ...services, covers: ['4.1/interaction-responses'] }, chapterBody()),
      },
      { coverable },
    )
    expect(problems.filter(problem => problem.includes('covers'))).toEqual([
      'content/4.1: covers "4.1/interaction-responses" is claimed by guards and services; one page only',
    ])
  })

  it("resolves a link to a glossary's term only on a page that defines terms", () => {
    const glossary = (terms?: boolean | string) =>
      page(
        {
          id: 'glossary',
          title: 'Glossary',
          chapter: 'appendix',
          group: 'help',
          order: 4,
          summary: 'The words.',
          ...(terms !== undefined && { terms }),
        },
        '**Cooldown store.** Where counts are kept.\n\n**`UserError`.** A refusal the user is shown.',
      )
    const linking = page(
      guards,
      chapterBody('[a](guide:glossary#cooldown-store) [b](guide:glossary#usererror) [c](guide:glossary#nope)'),
    )
    expect(check({ ...valid(), guards: linking, glossary: glossary(true) }, context)).toEqual([
      'content/4.1/guards.md: guide:glossary#nope names no heading of that page',
    ])
    expect(check({ ...valid(), guards: linking, glossary: glossary() }, context)).toEqual([
      'content/4.1/guards.md: guide:glossary#cooldown-store names no heading of that page',
      'content/4.1/guards.md: guide:glossary#usererror names no heading of that page',
      'content/4.1/guards.md: guide:glossary#nope names no heading of that page',
    ])
    expect(check({ ...valid(), glossary: glossary("'yes'") }, context)).toEqual([
      'content/4.1/glossary.md: terms is true or false',
    ])
  })

  it('links a generated page as a written one, and holds it to no template', () => {
    const reference = page(
      {
        id: 'config-reference',
        title: 'Reference',
        chapter: 'appendix',
        group: 'help',
        order: 90,
        summary: 'All options.',
      },
      '## appName\n\n```ts\nexport default {}\n```',
    )
    const linking = page(guards, chapterBody('See [appName](guide:config-reference#appname).'))
    const report = checkGuide(
      { guards: linking, services: page(services, chapterBody()) },
      {
        ...context,
        generated: { 'config-reference': reference },
      },
    )
    expect(report.problems).toEqual([])
    expect(report.planned).toEqual([])
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
      'content/4.1/guards.md: id "guard" is not the file\'s name',
      'content/4.1/guards.md: chapter "pipes" is none of start, interactions, messages, structure, pipeline, testing, shipping, appendix',
      'content/4.1/guards.md: order is not a whole number from 1',
      'content/4.1/guards.md: the summary is 161 characters, over 160',
      'content/4.1/notitle.md: front matter has no title',
      'content/4.1/notitle.md: front matter has no summary',
    ])
  })

  it('asks for two to four things to learn, and an api entry as <kind>/<Symbol> of the API', () => {
    const api = ['decorators/UseGuard#guards', 'utilities/Nope', 'utilities/UseGuard', 'decorators/UseGuard#nope']
    const named = check({ ...valid(), guards: page({ ...guards, api }, chapterBody()) }, context)
    expect(named).toEqual([
      'content/4.1/guards.md: api entry "utilities/Nope" names no symbol of the API',
      'content/4.1/guards.md: api entry "utilities/UseGuard" names a symbol filed under decorators, not utilities',
      'content/4.1/guards.md: api entry "decorators/UseGuard#nope" names no member of UseGuard',
    ])
    const problems = check(
      { ...valid(), guards: page({ ...guards, learn: ['a'], api: ['decorator/UseGuard', 'UseGuard'] }, chapterBody()) },
      context,
    )
    expect(problems).toEqual([
      'content/4.1/guards.md: learn has 1 item(s), not two to four',
      'content/4.1/guards.md: api entry "decorator/UseGuard" is not <kind>/<Symbol>, with a kind of controllers, decorators, responses, utilities, testing, configuration, cli, types',
      'content/4.1/guards.md: api entry "UseGuard" is not <kind>/<Symbol>, with a kind of controllers, decorators, responses, utilities, testing, configuration, cli, types',
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
      'content/4.1/guards.md: only an appendix page has a group',
      'content/4.1/faq.md: an appendix page has a group, one of recipes, coming-from, help',
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
      'content/4.1/guards.md: the body has an H1; the title is the H1',
      'content/4.1/guards.md: a heading is deeper than ###',
      'content/4.1/guards.md: the fixed sections run When to use it, Example, How it works, Gotchas, Build it, Next steps',
      'content/4.1/guards.md: a topic section sits outside How it works … Gotchas, Build it and Next steps',
      'content/4.1/guards.md: Build it comes right before Next steps',
    ])
    // Without Gotchas, a topic section after Next steps is still out of place.
    const trailing =
      chapterBody().replace('## Next steps', '## Build it\n\nGrow the bot.\n\n## Next steps') + '\n\n## Extra'
    expect(check({ ...valid(), guards: page(guards, trailing) }, context)).toEqual([
      'content/4.1/guards.md: a topic section sits outside How it works … Gotchas, Build it and Next steps',
    ])
    const missing = check({ ...valid(), guards: page(guards, 'Lead only.\n\n## Example') }, context)
    expect(missing).toContain('content/4.1/guards.md: the page has no "## When to use it" section')
    expect(missing).toContain('content/4.1/guards.md: the page has no "## Next steps" section')
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
      'content/4.1/tickets.md: a recipe has a "## Variations" section',
      'content/4.1/tickets.md: "## Setup" is no recipe section; use ### under one of them',
      "content/4.1/tickets.md: a recipe's sections run The code, How it works, Variations, Next steps",
    ])
    // An extra H2 in order is reported once, as the section it is not.
    const extra = ['Lead.', '## The code', '## Setup', '## How it works', '## Variations', '## Next steps'].join('\n\n')
    expect(check({ ...valid(), tickets: page(recipe, extra) }, context)).toEqual([
      'content/4.1/tickets.md: "## Setup" is no recipe section; use ### under one of them',
    ])
  })

  it('checks orders within a chapter, and what a page requires', () => {
    const problems = check(
      { ...valid(), cooldowns: page({ ...guards, id: 'cooldowns', requires: ['nothing'] }, chapterBody()) },
      context,
    )
    expect(problems).toEqual([
      "content/4.1/cooldowns.md: order 2 is also guards's",
      'content/4.1/cooldowns.md: requires "nothing", which is no page',
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
      '[l](api:decorators/UseGuard#guards)',
      // A member as it is named, as an option is: its anchor is lowercase
      '[l2](api:decorators/UseGuard#Guards)',
      '[m](api:decorators/UseGuard#nope)',
      '[n](api:types/UseGuard)',
      '[o](api:types/Guard)',
      '[p](https://meocord.dev/docs/4.1/guards)',
    ].join(' ')
    expect(check({ ...valid(), guards: page(guards, chapterBody(links)) }, context)).toEqual([
      'content/4.1/guards.md: guide:services#no-such names no heading of that page',
      'content/4.1/guards.md: guide:nothing names no Guide page',
      'content/4.1/guards.md: api:decorators/NoSuch names no symbol of the API',
      'content/4.1/guards.md: api:decorator/UseGuard is not api:<kind>/<Symbol>',
      'content/4.1/guards.md: /docs/4.1/guards links a page by path; write guide:<id> or api:<kind>/<Symbol>',
      'content/4.1/guards.md: no heading for #nowhere',
      'content/4.1/guards.md: api:decorators/UseGuard#nope names no member of UseGuard',
      'content/4.1/guards.md: api:types/UseGuard names a symbol filed under decorators, not types',
      'content/4.1/guards.md: https://meocord.dev/docs/4.1/guards links the site by its address; write guide:<id> or api:<kind>/<Symbol>',
    ])
  })

  it('counts a link to a planned page not written yet, and fails it once the Guide is complete', () => {
    const body = chapterBody('[a](guide:slash-commands) [b](guide:slash-commands#options) [c](guide:recipes/tickets)')
    const files = { ...valid(), guards: page({ ...guards, requires: ['services', 'first-command'] }, body) }
    expect(checkGuide(files, context)).toEqual({
      problems: [],
      planned: [
        'content/4.1/guards.md: requires "first-command"',
        'content/4.1/guards.md: guide:slash-commands',
        'content/4.1/guards.md: guide:slash-commands#options',
        'content/4.1/guards.md: guide:recipes/tickets',
      ],
    })
    expect(checkGuide(files, { ...context, complete: true }).problems).toEqual([
      'content/4.1/guards.md: requires "first-command", which is no page',
      'content/4.1/guards.md: guide:slash-commands names no Guide page',
      'content/4.1/guards.md: guide:slash-commands#options names no Guide page',
      'content/4.1/guards.md: guide:recipes/tickets names no Guide page',
    ])
  })

  it("holds every page to the Guide's plan", () => {
    const extra = { ...guards, id: 'extras', title: 'Extras', order: 3 }
    expect(check({ ...valid(), extras: page(extra, chapterBody()) })).toEqual([
      "content/4.1/extras.md: extras is not a page of the Guide's plan",
    ])
  })

  it('links the migration guide by guide:migrating, checking its heading, and never on GitHub', () => {
    const github = 'https://github.com/meocord/meocord/blob/main/docs/MIGRATING.md'
    const body = chapterBody(
      `[a](guide:migrating#start) [b](guide:migrating#nope) [c](guide:changelog) [d](${github}#start)`,
    )
    expect(check({ ...valid(), guards: page(guards, body) }, { migratingAnchors: new Set(['start']) })).toEqual([
      'content/4.1/guards.md: guide:migrating#nope names no heading of the migration guide',
      `content/4.1/guards.md: ${github}#start links the migration guide on GitHub; write guide:migrating#start`,
    ])
  })

  it('takes NOTE, TIP and WARNING callouts, one to a section', () => {
    const body = chapterBody(
      ['> [!NOTE]\n> One.', '> [!WARNING]\n> Two.', '> [!CAUTION]\n> Three.', '```text\n> [!IMPORTANT]\n```'].join(
        '\n\n',
      ),
    )
    expect(check({ ...valid(), guards: page(guards, body) })).toEqual([
      'content/4.1/guards.md: "How it works" has more than one callout',
      "content/4.1/guards.md: a [!CAUTION] callout; a page's callouts are NOTE, TIP and WARNING",
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
        '```dockerfile\nFROM node:22-slim\n```',
        '::example{file="missing.ts"}',
        '::figure{name="pipeline"}',
        '::figure{name="map"}',
      ].join('\n\n'),
    )
    expect(check({ ...valid(), guards: page(guards, body) }, context)).toEqual([
      'content/4.1/guards.md: a code fence is marked "cobol"; a page\'s fences are bash, json, yaml, text, dotenv, dockerfile, ini, toml',
      'content/4.1/guards.md: a code fence is marked "diff"; a page\'s fences are bash, json, yaml, text, dotenv, dockerfile, ini, toml',
      'content/4.1/guards.md: TypeScript belongs in examples/4.1 and an ::example directive, not a code fence',
      'content/4.1/guards.md: ::figure{name="map"} names no figure; a page can draw pipeline',
      'content/4.1/guards.md: examples/4.1/src/missing.ts does not exist',
      'content/4.1/guards.md: examples/4.1/src/guards/owner.guard.ts has no region "nope"',
      'content/4.1/guards.md: an ::example reads from "4.0", but only "compare" can be named',
      'content/4.1/guards.md: an ::example names no file',
    ])
  })
})

describe('::playground', () => {
  it('takes a file of the line with a region and a dispatch that parses, importing only the runtime', () => {
    const body = chapterBody(
      [
        '::playground{file="button/counter.ts" region="count" dispatch="button counter/1; /ping n:1"}',
        '::playground{file="button/counter.ts" dispatch="message !ping"}',
        '```text\n::playground{file="missing.ts"}\n```',
      ].join('\n\n'),
    )
    expect(check({ ...valid(), guards: page(guards, body) })).toEqual([])
  })

  it('refuses a missing file or region, an import the runtime lacks, a dispatch that does not parse, and other attributes', () => {
    const body = chapterBody(
      [
        '::playground{region="count" dispatch="/ping"}',
        '::playground{file="missing.ts" dispatch="/ping"}',
        '::playground{file="button/counter.ts" region="nope" dispatch="/ping"}',
        '::playground{file="button/uses-service.ts" dispatch="/ping"}',
        '::playground{file="button/counter.ts"}',
        '::playground{file="button/counter.ts" dispatch="/ping; select"}',
        '::playground{file="button/counter.ts" from="compare" dispatch="/ping"}',
        'Run it: ::playground{file="button/counter.ts" dispatch="/ping"} here.',
        'A line before it\n::playground{file="button/counter.ts" dispatch="/ping"}',
        '  ::playground{file="button/counter.ts" dispatch="/ping"}',
      ].join('\n\n'),
    )
    expect(check({ ...valid(), guards: page(guards, body) })).toEqual([
      'content/4.1/guards.md: a ::playground stands alone in its paragraph, not in "Run it: ::playground{file="button/counter.ts" dispatch="/ping"} here."',
      'content/4.1/guards.md: a ::playground stands alone in its paragraph, not in "::playground{file="button/counter.ts" dispatch="/ping"}"',
      'content/4.1/guards.md: a ::playground stands alone in its paragraph, not in "  ::playground{file="button/counter.ts" dispatch="/ping"}"',
      'content/4.1/guards.md: a ::playground names no file',
      'content/4.1/guards.md: examples/4.1/src/missing.ts does not exist',
      'content/4.1/guards.md: examples/4.1/src/button/counter.ts has no region "nope"',
      "content/4.1/guards.md: examples/4.1/src/button/uses-service.ts imports '../services/greeter'; a playground runs one file, which imports only discord.js, meocord/common, meocord/decorator, meocord/enum, meocord/interface, meocord/testing, reflect-metadata",
      'content/4.1/guards.md: a ::playground names no dispatch',
      'content/4.1/guards.md: dispatch step 2: select needs a customId',
      'content/4.1/guards.md: a ::playground takes file, region, dispatch, not from',
    ])
  })
})

describe('the plan', () => {
  it("takes none of the site's own paths: the routed ones, read from the app, the playground among them", () => {
    expect(routedSlugs(process.cwd())).toEqual(
      expect.arrayContaining(['api', 'changelog', 'migrating', 'missing', 'playground']),
    )
    expect(reservedProblems(process.cwd())).toEqual([])
    expect(
      reservedProblems(process.cwd(), {
        ...GUIDE_PLAN,
        appendix: ['missing', 'playground', 'api/x', 'recipes', 'recipes/tickets'],
      }),
    ).toEqual([
      'The Guide\'s plan has "missing", a path the site routes itself',
      'The Guide\'s plan has "playground", a path the site routes itself',
      'The Guide\'s plan has "api/x", a path the site routes itself',
      'The Guide\'s plan has "recipes", a path the site routes itself',
    ])
    const pages = Object.values(GUIDE_PLAN).flat()
    expect(
      pages.filter(path => path.includes('/') && !['recipes', 'coming-from'].includes(path.split('/')[0]!)),
    ).toEqual([])
    expect(pages).toContain('what-can-i-build')
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
    covers: [],
    terms: false,
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

describe('unembeddedRegions', () => {
  const examples = {
    'src/guards/owner.guard.ts': '// #region guard\n// #endregion guard\n// #region old\n// #endregion old\n',
    'src/tutorial/app.ts': '// #region step:guards\n// #endregion step:guards\n',
    'src/home/pipeline.ts': '// #region home\n// #endregion home\n',
    'package.json': '// #region not source\n',
  }
  const pages = [
    '::example{file="guards/owner.guard.ts" region="guard"}',
    '```md\n::example{file="guards/owner.guard.ts" region="old"}\n```',
  ]

  it("names each region no page embeds and the site doesn't show, leaving tutorial steps alone", () => {
    expect(
      unembeddedRegions('4.1', examples, pages, { shown: [{ file: 'home/pipeline.ts', region: 'home' }] }),
    ).toEqual(['examples/4.1/src/guards/owner.guard.ts: region "old" is embedded by no page; embed it, or remove it'])
  })

  it('counts an embed only in the folder it names, as from="compare" does', () => {
    const compare = { 'src/discordjs/bot.ts': '// #region client\n// #endregion client\n' }
    expect(
      unembeddedRegions('compare', compare, ['::example{file="discordjs/bot.ts" region="client"}'], {
        from: 'compare',
      }),
    ).toEqual(['examples/compare/src/discordjs/bot.ts: region "client" is embedded by no page; embed it, or remove it'])
    expect(
      unembeddedRegions('compare', compare, ['::example{from="compare" file="discordjs/bot.ts" region="client"}'], {
        from: 'compare',
      }),
    ).toEqual([])
  })
})

describe('guideRendered', () => {
  it('follows versions.json as it changes, and reads one root the same however it is written', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'guide-rendered-'))
    const file = path.join(root, 'versions.json')
    const write = (guides: string, at: number) => {
      const lines = [{ line: '4.1', status: 'prerelease', guides, versions: ['4.1.0'] }]
      const provenance = { issuer: 'https://token.actions.githubusercontent.com' }
      writeFileSync(file, JSON.stringify({ package: 'meocord', since: '4.1.0', provenance, lines }))
      utimesSync(file, at, at)
    }
    write('readme', 1_000)
    expect(guideRendered('4.1', root)).toBe(false)
    write('authored', 2_000)
    expect(guideRendered('4.1', root)).toBe(true)
    expect(guideRendered('4.1', `${root}/`)).toBe(true)
  })
})

describe('counterpartIn', () => {
  const page = (id: string, formerly: string[] = [], covers: string[] = []) => ({ id, formerly, covers })
  const readme = [page('command-types'), page('testing'), page('configuration'), page('guards')]

  it('takes the page with the same id first', () => {
    expect(counterpartIn(readme, '4.0', page('guards', [], ['4.0/testing']), '4.1')?.page.id).toBe('guards')
  })

  it('then the page this one covers in that line, at the section it names', () => {
    expect(counterpartIn(readme, '4.0', page('eslint', [], ['4.0/configuration#eslint']), '4.1')).toEqual({
      page: readme[2],
      anchor: 'eslint',
    })
    // A covered page of another line is no match here
    expect(counterpartIn(readme, '4.0', page('eslint', [], ['3.9/configuration']), '4.1')).toBeUndefined()
  })

  it('then a page of that line covering this one, first in order', () => {
    const guide = [page('slash-commands', [], ['4.0/command-types']), page('context-menus', [], ['4.0/command-types'])]
    expect(counterpartIn(guide, '4.1', page('command-types'), '4.0')?.page.id).toBe('slash-commands')
    expect(counterpartIn(guide, '4.1', page('command-types'), '3.9')).toBeUndefined()
  })

  it('then a page that took an old slug of it, or of which it took one', () => {
    expect(counterpartIn([page('first-command', ['quick-start'])], '4.1', page('quick-start'), '4.0')?.page.id).toBe(
      'first-command',
    )
    expect(counterpartIn(readme, '4.0', page('slash-commands', ['command-types']), '4.1')?.page.id).toBe(
      'command-types',
    )
  })
})

describe('pageKnownAs', () => {
  it("finds a line's page by its id, a retired id of that line it covers, or an old slug", () => {
    const guide = [
      { id: 'responses', formerly: [], covers: ['4.1/interaction-responses', '4.0/answers'] },
      { id: 'first-command', formerly: ['quick-start'], covers: [] },
    ]
    expect(pageKnownAs(guide, '4.1', 'responses')?.id).toBe('responses')
    expect(pageKnownAs(guide, '4.1', 'interaction-responses')?.id).toBe('responses')
    expect(pageKnownAs(guide, '4.1', 'quick-start')?.id).toBe('first-command')
    // Another line's id is no id of this line
    expect(pageKnownAs(guide, '4.1', 'answers')).toBeUndefined()
  })
})
