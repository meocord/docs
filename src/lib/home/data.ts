import { readFileSync } from 'node:fs'
import path from 'node:path'
import { migratingGuide, resolveExample } from '../../../scripts/lib/pages'
import { HOME_EXAMPLE, HOME_LINE } from '@/config/home'
import { VERSIONS } from '@/config/versions'
import { apiLandingHref } from '@/lib/docs/api-site'
import { guideEntries, guidePageHref, hasPlaygroundPage, resolveGuideLink } from '@/lib/docs/guide-site'
import { lowerMarkdown, type Lowered } from '@/lib/prose/lower'
import { docsHref } from '@/lib/urls'

/** One stage of the pipeline panel, in the order a call meets it. */
export type StageId = 'defer' | 'guard' | 'interceptor:before' | 'pipe' | 'handler' | 'interceptor:after' | 'respond'

export interface Stage {
  id: StageId
  /** What the trace lists it as. */
  name: string
  /** One sentence on what the stage does, shown while it is current. */
  narration: string
  /** The line of the example that declares it, 0-based, or undefined for none. */
  line?: number
  /** What the recorded run saw there, for a member and for a blocked user. */
  member: string
  blocked: string
}

/** What the example's recording captured: .home-trace/trace.json, written by `bun run home:trace`. */
interface Recording {
  command: string
  option: { name: string }
  member: Run
  blocked: Run
}

interface Run {
  ran: boolean
  events: { stage: string; note: string }[]
  reply: string | null
  error: { name: string; message: string } | null
}

export interface PipelineDemo {
  /** The example's `home` region, exactly as the file has it. */
  source: string
  file: string
  command: string
  option: string
  stages: Stage[]
  memberReply: string
  blockedReply: string
  blockedError: string
}

const NARRATION: Record<StageId, string> = {
  defer: 'Acknowledged at once, so a slow handler never runs out Discord’s three seconds.',
  guard: 'Guards run first. One that throws GuardDeniedError is answered privately, with its reason.',
  'interceptor:before': 'Interceptors wrap everything after the guards, on the way in.',
  pipe: 'Pipes shape each option before the handler sees it.',
  handler: 'The handler runs with input that has been checked and shaped.',
  'interceptor:after': 'The interceptor sees the result on the way out.',
  respond: 'respond() edits the deferred reply: one call, whatever the state.',
}

const NAMES: Record<StageId, string> = {
  defer: '@Defer',
  guard: 'MemberGuard',
  'interceptor:before': 'TraceInterceptor',
  pipe: 'TrimPipe',
  handler: 'greet()',
  'interceptor:after': 'TraceInterceptor',
  respond: 'respond()',
}

// The declaration each stage comes from, found in the source rather than counted by hand.
const DECLARED_BY: Partial<Record<StageId, RegExp>> = {
  defer: /^\s*@Defer\(/,
  guard: /^\s*@UseGuard\(/,
  'interceptor:before': /^\s*@UseInterceptor\(/,
  pipe: /^\s*@UsePipe\(/,
  handler: /^\s*async greet\(/,
  'interceptor:after': /^\s*@UseInterceptor\(/,
  respond: /respond\(/,
}

function recording(): Recording {
  return JSON.parse(readFileSync(path.join(process.cwd(), '.home-trace', 'trace.json'), 'utf8')) as Recording
}

/** The pipeline panel's data: the example's source, and what its recorded runs did at each stage. */
export function pipelineDemo(): PipelineDemo {
  const rec = recording()
  const source = resolveExample(HOME_LINE, HOME_EXAMPLE.file, HOME_EXAMPLE.region)
  const lines = source.split('\n')
  const note = (run: Run, stage: string) => run.events.find(event => event.stage === stage)?.note
  const skipped = 'not reached'

  const stages = (Object.keys(NAMES) as StageId[]).map<Stage>(id => {
    const declared = DECLARED_BY[id]
    const line = declared ? lines.findIndex(text => declared.test(text)) : -1
    const recorded = {
      handler: {
        member: rec.member.ran ? `greets ${JSON.stringify(rec.option.name.trim())}` : skipped,
        blocked: rec.blocked.ran ? 'ran' : skipped,
      },
      respond: { member: rec.member.reply ?? skipped, blocked: skipped },
    }[id as 'handler' | 'respond']
    return {
      id,
      name: NAMES[id],
      narration: NARRATION[id],
      line: line >= 0 ? line : undefined,
      member: recorded?.member ?? note(rec.member, id) ?? skipped,
      blocked: recorded?.blocked ?? note(rec.blocked, id) ?? skipped,
    }
  })

  return {
    source,
    file: `src/${HOME_EXAMPLE.file}`,
    command: rec.command,
    option: rec.option.name,
    stages,
    memberReply: rec.member.reply ?? '',
    blockedReply: rec.blocked.error?.message ?? '',
    blockedError: rec.blocked.error?.name ?? '',
  }
}

/** A claim of the Why strip: what MeoCord does for a bot, and the Guide page that shows it. */
export interface Claim {
  title: string
  body: Lowered['nodes']
  href: string
}

/**
 * The Why strip's claims, each a headline, a line of Markdown, and the Guide page or section that shows
 * it, written `guide:<path>[#<heading>]`; data.spec checks the Guide has every one.
 */
export const CLAIMS: readonly { title: string; body: string; guide: string }[] = [
  {
    title: 'One call answers Discord.',
    body: '`respond()` tracks each answer as unanswered, deferred or replied, and makes the call Discord expects: reply, update, edit or follow-up.',
    guide: 'guide:responses#how-it-works',
  },
  {
    title: 'Tested as it runs.',
    body: "`invoke` and `dispatch` run a handler through the bot's own pipeline, with mocks of discord.js's own classes.",
    guide: 'guide:testing',
  },
  {
    title: 'One pipeline, every call.',
    body: 'Guards, interceptors, validation, cooldowns and exception filters run in a fixed order around every handler.',
    guide: 'guide:how-a-call-runs',
  },
  {
    title: 'Checked by the compiler.',
    body: "A handler whose params don't fit its route or pattern fails to compile, and so does a catalog key the default catalog lacks.",
    guide: 'guide:components#typed-params',
  },
]

export function claims(): Claim[] {
  return CLAIMS.map(({ title, body, guide }) => ({
    title,
    body: lowerMarkdown(body).nodes,
    href: resolveGuideLink(HOME_LINE, guide),
  }))
}

/** A kind of handler, as What you can build shows it: its section there, and the sentence that opens it. */
export interface BuildKind {
  title: string
  href: string
  lead: Lowered['nodes']
}

const BUILD_PAGE = 'what-can-i-build'

/** Each kind of handler What you can build shows, in its order, linking its section there. */
export function buildKinds(): BuildKind[] {
  const entry = guideEntries(HOME_LINE).find(candidate => candidate.page.id === BUILD_PAGE)
  if (!entry) throw new Error(`The home page lists the kinds of ${BUILD_PAGE}, which ${HOME_LINE}'s Guide lacks.`)
  const sections = entry.body.split(/^## /m).slice(1)
  const headings = lowerMarkdown(entry.body).headings.filter(heading => heading.depth === 2)
  return sections.flatMap((section, index) => {
    const heading = headings[index]
    if (heading.title === 'Next steps') return []
    // The section's first sentence, from the paragraph under its heading
    const paragraph = section.split('\n\n')[1] ?? ''
    const sentence = /^[\s\S]*?[.:](?=\s|$)/.exec(paragraph.replace(/\n/g, ' '))?.[0] ?? paragraph
    return [
      {
        title: heading.title,
        href: guidePageHref(HOME_LINE, entry.page, heading.id),
        lead: lowerMarkdown(sentence.replace(/:$/, '.')).nodes,
      },
    ]
  })
}

/** One of the home page's doors: where a reader goes next, by what they came to do. */
export interface Door {
  title: string
  body: string
  links: { title: string; href: string }[]
}

/** The three doors: learn from the Guide, look something up, or move from another version or framework. */
export function doors(): Door[] {
  const pages = guideEntries(HOME_LINE).map(({ page }) => page)
  const page = (id: string) => pages.find(candidate => candidate.id === id)
  const link = (id: string) => {
    const found = page(id)
    return found ? [{ title: found.title, href: guidePageHref(HOME_LINE, found) }] : []
  }
  const api = apiLandingHref(HOME_LINE)
  return [
    {
      title: 'Learn',
      body: 'The Guide, in reading order: what a bot is made of, each kind of handler, the pipeline around it, testing and shipping.',
      links: [
        ...link(pages[0]?.id ?? ''),
        ...link('getting-started'),
        ...link('first-command'),
        ...(hasPlaygroundPage(HOME_LINE)
          ? [{ title: 'Playground', href: docsHref({ kind: 'playground', line: HOME_LINE }, VERSIONS) }]
          : []),
      ],
    },
    {
      title: 'Look up',
      body: 'Every public symbol, by kind, with its types and examples, and every CLI command with its options.',
      links: [
        ...(api ? [{ title: 'API reference', href: api }] : []),
        { title: 'CLI', href: docsHref({ kind: 'api-index', line: HOME_LINE, section: 'cli' }, VERSIONS) },
      ],
    },
    {
      title: 'Migrate or compare',
      body: `Moving to ${HOME_LINE} from an earlier MeoCord, or to MeoCord from another framework.`,
      links: [
        ...(migratingGuide(HOME_LINE) !== undefined
          ? [{ title: `Migrating to ${HOME_LINE}`, href: docsHref({ kind: 'migrating', line: HOME_LINE }, VERSIONS) }]
          : []),
        ...link('whats-new'),
        ...pages
          .filter(candidate => candidate.group === 'coming-from')
          .map(candidate => ({ title: candidate.title, href: guidePageHref(HOME_LINE, candidate) })),
      ],
    },
  ]
}
