import { A, type Children, Code, Dd, Div, Dl, Dt, H2, H3, Li, Ol, P, Pre, Section, Span, Strong, Ul } from '@meonode/ui'
import { markSvgNode } from '@/components/home/mark-node'
import { codeFrame } from '@/lib/prose/code'
import type { Claim, Feature, FeatureResult } from '@/lib/home/data'

// The bot's answer, as the channel shows it: its mark, its name, and what it said.
function botMessage(body: Children, secret: boolean) {
  return Div({
    'data-message': true,
    children: [
      Div({ key: 'avatar', 'data-avatar': true, 'aria-hidden': true, children: markSvgNode(18) }),
      Div({
        key: 'body',
        children: [
          Div({
            key: 'who',
            'data-who': true,
            children: [Strong('greeter', { key: 'n' }), Span('APP', { key: 'a', 'data-app': true })],
          }),
          secret ? Div({ key: 'private', 'data-private': true, children: 'Only you can see this' }) : null,
          body,
        ],
      }),
    ],
  })
}

function ResultPanel(result: FeatureResult) {
  const label = (children: Children) => P(children, { key: 'label', 'data-result-label': true })
  if (result.kind === 'route') {
    const row = (term: string, value: string) => [
      Dt({ key: `${term}-t`, children: term }),
      Dd({ key: `${term}-d`, children: value }),
    ]
    return Div({
      'data-result': 'route',
      children: [
        label(['A click on ', Code(result.customId, { key: 'c' }), ' reaches']),
        Dl({
          key: 'route',
          'data-route': true,
          children: [
            ...row('handler', result.handler),
            ...Object.entries(result.params).flatMap(([name, value]) => row(name, JSON.stringify(value))),
          ],
        }),
      ],
    })
  }
  const said =
    result.kind === 'private'
      ? Div({ key: 'said', 'data-said': true, children: result.text })
      : Div({
          key: 'said',
          'data-embed': true,
          style: { '--embed-color': result.color },
          children: [Strong(result.title, { key: 't' }), Span(result.text, { key: 'd', 'data-said': true })],
        })
  return Div({
    'data-result': result.kind,
    children: [
      label(['After ', Code(result.command, { key: 'c' }), ', the user sees']),
      botMessage(said, result.kind === 'private' || result.private),
    ],
  })
}

export function FeatureSection(items: Feature[]) {
  return Section({
    key: 'features',
    'aria-labelledby': 'features',
    children: [
      H2('What you write, what they see', { key: 'h', id: 'features' }),
      ...items.map(item =>
        Div({
          key: item.title,
          'data-row': true,
          children: [
            Div({
              key: 'text',
              children: [
                H3(item.title, { key: 'h' }),
                P(item.body, { key: 'p' }),
                A({ key: 'a', 'data-more': true, href: item.href, children: 'Read the guide' }),
              ],
            }),
            Div({
              key: 'code',
              children: [codeFrame(item.code, 'ts', { key: 0, file: item.file }), ResultPanel(item.result)],
            }),
          ],
        }),
      ),
    ],
  })
}

export function WhySection(claims: Claim[]) {
  return Section({
    key: 'why',
    'aria-labelledby': 'why',
    children: [
      H2('Why MeoCord', { key: 'h', id: 'why' }),
      ...claims.map(claim =>
        Div({
          key: claim.title,
          'data-row': true,
          children: [
            Div({
              key: 'text',
              children: [
                H3(claim.title, { key: 'h' }),
                P(claim.body, { key: 'p' }),
                A({ key: 'a', 'data-more': true, href: claim.href, children: 'Read the guide' }),
              ],
            }),
            codeFrame(claim.code, 'ts', { key: 1, file: claim.file }),
          ],
        }),
      ),
    ],
  })
}

export function StartSection(guideHref: string) {
  const step = (key: number, text: string, code: string, language: string) =>
    Li({ key, children: Div({ children: [P(text, { key: 'p' }), codeFrame(code, language, { key: 1 })] }) })
  return Section({
    key: 'start',
    'aria-labelledby': 'start',
    children: [
      H2('Start in three steps', { key: 'h', id: 'start' }),
      Ol({
        key: 'steps',
        'data-steps': true,
        children: [
          step(1, 'Create a bot. The CLI asks which package manager to use.', 'npx meocord create my-bot', 'shell'),
          step(2, 'Give it its token, in .env beside meocord.config.ts.', 'DISCORD_TOKEN=your-bot-token', 'dotenv'),
          step(3, 'Run it, rebuilding as you save.', 'npx meocord start --dev', 'shell'),
        ],
      }),
      A({ key: 'more', 'data-more': true, href: guideHref, children: 'Read the quick start' }),
    ],
  })
}

export function TestingSection(spec: { file: string; code: string; report: string[] }, href: string) {
  const output = [
    Span(`✓ ${spec.file}`, { key: 'file', 'data-pass': true }),
    `  (${spec.report.length} ${spec.report.length === 1 ? 'test' : 'tests'})\n`,
    ...spec.report.map((line, index) => Span(`  ✓ ${line}\n`, { key: `t${index}` })),
    '\n',
    Span(`Test Files  `, { key: 'sum' }),
    Span('1 passed', { key: 'p', 'data-pass': true }),
    `\n     Tests  `,
    Span(`${spec.report.length} passed`, { key: 'p2', 'data-pass': true }),
  ]
  return Section({
    key: 'testing',
    'aria-labelledby': 'testing',
    children: [
      H2('Tested the way it runs', { key: 'h', id: 'testing' }),
      Div({
        key: 'row',
        'data-row': true,
        children: [
          Div({
            key: 'text',
            children: [
              P(
                'This spec is the one the docs run against every build. invoke() takes the call through the same stages dispatch does, so the order it asserts is the order your bot runs.',
                { key: 'p' },
              ),
              A({ key: 'a', 'data-more': true, href, children: 'Read about testing' }),
            ],
          }),
          Div({
            key: 'code',
            children: [
              codeFrame(spec.code, 'ts', { key: 0, file: spec.file }),
              Pre(output, { key: 'out', 'data-run-output': true, 'aria-label': 'Vitest output' }),
            ],
          }),
        ],
      }),
    ],
  })
}

export function NewSection(line: string, items: { title: string; href: string }[], href: string) {
  return Section({
    key: 'new',
    'aria-labelledby': 'new',
    children: [
      H2(`New in ${line}`, { key: 'h', id: 'new' }),
      Ul({
        key: 'items',
        'data-news': true,
        children: items.map(({ href: to, title }) => Li({ key: to, children: A({ href: to, children: title }) })),
      }),
      P(A({ 'data-more': true, href, children: `Read what’s new in ${line}` }), { key: 'more' }),
    ],
  })
}
