import { readFileSync } from 'node:fs'
import path from 'node:path'
import { loadPage, resolveExample } from '../../../scripts/lib/pages'
import { VERSIONS } from '@/config/versions'
import { lowerMarkdown } from '@/lib/prose/lower'
import { docsHref } from '@/lib/urls'

/** The line the home page draws its examples from. */
export const HOME_LINE = '4.1'

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

/** What the example's recording captured: generated/home/trace.json, written by `bun run home:trace`. */
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

const EXAMPLE_FILE = 'home/pipeline.slash.controller.ts'

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
  return JSON.parse(readFileSync(path.join(process.cwd(), 'generated', 'home', 'trace.json'), 'utf8')) as Recording
}

/** The pipeline panel's data: the example's source, and what its recorded runs did at each stage. */
export function pipelineDemo(): PipelineDemo {
  const rec = recording()
  const source = resolveExample(HOME_LINE, EXAMPLE_FILE, 'home')
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
    file: `src/${EXAMPLE_FILE}`,
    command: rec.command,
    option: rec.option.name,
    stages,
    memberReply: rec.member.reply ?? '',
    blockedReply: rec.blocked.error?.message ?? '',
    blockedError: rec.blocked.error?.name ?? '',
  }
}

/** A claim on the home page, and the example region that makes it good. */
export interface Claim {
  title: string
  body: string
  file: string
  code: string
  href: string
}

const guide = (slug: string, anchor?: string) => docsHref({ kind: 'guide', line: HOME_LINE, slug, anchor }, VERSIONS)

/** Why MeoCord, in three claims, each with the typechecked example that backs it. */
export function claims(): Claim[] {
  const claim = (title: string, body: string, file: string, region: string, href: string): Claim => ({
    title,
    body,
    file,
    code: resolveExample(HOME_LINE, file, region),
    href,
  })
  return [
    claim(
      'A guard, not a router',
      'Who may run a command is declared beside it. A guard that says no can say why, and the user is answered privately.',
      'guards/owner.guard.ts',
      'guard',
      guide('guards'),
    ),
    claim(
      'One answer, whatever the state',
      'respond() knows whether the interaction was deferred or replied to, and makes the right Discord call, every time.',
      'controllers/slash/profile.slash.controller.ts',
      'respond',
      guide('responses'),
    ),
    claim(
      'Test the whole pipeline',
      'invoke() runs a handler through everything dispatch runs around it: defer, guards, interceptors, pipes and filters.',
      'controllers/slash/stages.slash.controller.spec.ts',
      'spec',
      guide('testing'),
    ),
  ]
}

/** The headings of what's new in the line, each linking to its section. */
export function whatsNew(): { title: string; href: string }[] {
  const page = loadPage(HOME_LINE, 'whats-new')
  if (!page) return []
  return lowerMarkdown(page.body)
    .headings.filter(heading => heading.depth === 2)
    .map(heading => ({ title: heading.title, href: guide('whats-new', heading.id) }))
}

/** The spec behind the testing claim, as Vitest reports it passing. */
export function specReport(): { file: string; lines: string[] } {
  const file = 'src/controllers/slash/stages.slash.controller.spec.ts'
  const source = readFileSync(path.join(process.cwd(), 'examples', HOME_LINE, file), 'utf8')
  const suite = /describe\('([^']+)'/.exec(source)?.[1] ?? ''
  const tests = [...source.matchAll(/\bit\('([^']+)'/g)].map(match => match[1])
  return { file, lines: tests.map(test => `${suite} › ${test}`) }
}
