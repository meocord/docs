import { A, Div, H2, H3, Li, Ol, P, Section, Ul } from '@meonode/ui'
import { codeFrame } from '@/lib/prose/code'
import type { BuildKind, Claim, Door } from '@/lib/home/data'

/** What you can build: a tile for each kind of handler, opening its section of What you can build. */
export function BuildSection(kinds: BuildKind[]) {
  return Section({
    key: 'build',
    'aria-labelledby': 'build',
    children: [
      H2('What you can build', { key: 'h', id: 'build' }),
      Ul({
        key: 'kinds',
        'data-tiles': true,
        children: kinds.map(kind =>
          Li({
            key: kind.href,
            children: A({
              href: kind.href,
              'data-tile': true,
              children: [H3(kind.title, { key: 'h' }), Div({ key: 'lead', children: kind.lead })],
            }),
          }),
        ),
      }),
    ],
  })
}

/** Why MeoCord: each claim in a line or two, linking the Guide section that shows it. */
export function WhySection(claims: Claim[]) {
  return Section({
    key: 'why',
    'aria-labelledby': 'why',
    children: [
      H2('Why MeoCord', { key: 'h', id: 'why' }),
      Ul({
        key: 'claims',
        'data-claims': true,
        children: claims.map(claim =>
          Li({
            key: claim.title,
            children: [
              H3(claim.title, { key: 'h' }),
              Div({ key: 'p', children: claim.body }),
              A({ key: 'a', 'data-more': true, href: claim.href, children: 'See how' }),
            ],
          }),
        ),
      }),
    ],
  })
}

/** The quick start's three steps; `spec` is the package spec that installs the home page's line. */
function startSteps(spec: string) {
  const step = (key: number, text: string, code: string, language: string) =>
    Li({ key, children: Div({ children: [P(text, { key: 'p' }), codeFrame(code, language, { key: 1 })] }) })
  return Ol({
    key: 'steps',
    'data-steps': true,
    'aria-label': 'Start in three steps',
    children: [
      step(1, 'Create a bot. The CLI asks which package manager to use.', `npx ${spec} create my-bot`, 'shell'),
      step(2, 'Give it its token, in .env beside meocord.config.ts.', 'DISCORD_TOKEN=your-bot-token', 'dotenv'),
      step(3, 'Run it, rebuilding as you save.', 'npx meocord start --dev', 'shell'),
    ],
  })
}

/** The three doors, by what a reader came to do; the first holds the quick start's steps. */
export function DoorsSection(doors: Door[], spec: string) {
  return Section({
    key: 'doors',
    'aria-labelledby': 'doors',
    children: [
      H2('Where to go next', { key: 'h', id: 'doors' }),
      Div({
        key: 'doors',
        'data-doors': true,
        children: doors.map((door, index) =>
          Div({
            key: door.title,
            'data-door': true,
            children: [
              H3(door.title, { key: 'h' }),
              P(door.body, { key: 'p' }),
              index === 0 ? startSteps(spec) : null,
              Ul({
                key: 'links',
                children: door.links.map(link =>
                  Li({ key: link.href, children: A({ href: link.href, children: link.title }) }),
                ),
              }),
            ],
          }),
        ),
      }),
    ],
  })
}
