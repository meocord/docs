import {
  A,
  type Children,
  Code,
  createNode,
  Dd,
  Div,
  Dl,
  Dt,
  H2,
  H3,
  Li,
  Ol,
  P,
  Pre,
  Section,
  Span,
  Strong,
  Ul,
} from '@meonode/ui'
import { markSvgNode } from '@/components/home/mark-node'
import { hitAreaCss } from '@/lib/design/css'
import { codeFrame } from '@/lib/prose/code'
import type { Claim, Feature, FeatureResult } from '@/lib/home/data'

/**
 * The home page's sections below the pipeline panel, laid out in rows: a claim beside the code that
 * backs it, the steps to start, a spec beside its passing run, and what is new. Their code frames are
 * the docs' own, styled by the Prose container around them; this lays them out.
 */
export const HomeRows = createNode('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: 'theme.space.16',
  css: {
    '& section > h2': { margin: '0 0 theme.space.6' },
    '& [data-row]': {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)',
      columnGap: 'theme.space.10',
      rowGap: 'theme.space.4',
      alignItems: 'start',
      padding: 'theme.space.8 0',
      borderTop: 'theme.line.width solid theme.line.hairline',
    },
    '& [data-row]:first-of-type': { borderTop: 'none', paddingTop: 0 },
    '@media (width < 1100px)': { '& [data-row]': { gridTemplateColumns: 'minmax(0, 1fr)' } },
    '& [data-row] h3': { margin: '0 0 theme.space.2' },
    '& [data-row] p': { margin: '0 0 theme.space.3', color: 'theme.ink.secondary' },
    '& [data-row] [data-code]': { margin: 0 },
    // A row's code reads whole at any width: long lines wrap, continuing under a hanging indent. Lines
    // are rows of a flex column, so the newlines between them are not drawn twice.
    '& [data-row] [data-code] pre code': { display: 'flex', flexDirection: 'column', whiteSpace: 'pre-wrap' },
    '& [data-row] [data-code] .line': {
      minHeight: '1lh',
      paddingLeft: '4ch',
      textIndent: '-4ch',
      overflowWrap: 'anywhere',
    },
    '& [data-more]': { fontSize: 'theme.type.small.size', ...hitAreaCss },

    '& [data-steps]': { margin: 0, padding: 0, listStyle: 'none', counterReset: 'step' },
    '& [data-steps] > li': {
      counterIncrement: 'step',
      display: 'grid',
      gridTemplateColumns: '32px minmax(0, 1fr)',
      columnGap: 'theme.space.4',
      margin: '0 0 theme.space.6',
    },
    '& [data-steps] > li::before': {
      content: 'counter(step)',
      display: 'grid',
      placeItems: 'center',
      width: 28,
      height: 28,
      borderRadius: '50%',
      backgroundColor: 'theme.accent.band',
      color: 'theme.accent.default',
      fontSize: 'theme.type.small.size',
      fontWeight: 'theme.font.weight.semibold',
    },
    '& [data-steps] > li > div > p': { margin: '2px 0 theme.space.3', color: 'theme.ink.primary' },

    // The spec's run, drawn as a terminal reports it.
    '& [data-run-output]': {
      margin: 0,
      padding: 'theme.space.4',
      borderRadius: 'theme.radius.code',
      border: 'theme.line.width solid theme.line.hairline',
      backgroundColor: 'theme.surface.canvas',
      fontFamily: 'theme.font.mono',
      fontSize: 'theme.type.code.size',
      lineHeight: 'theme.type.code.line',
      color: 'theme.ink.secondary',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    },
    '& [data-pass]': { color: 'theme.callout.tip.glyph' },

    '& [data-news]': {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'theme.space.2',
      margin: 0,
      padding: 0,
      listStyle: 'none',
    },
    '& [data-news] a': {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: 32,
      padding: '0 theme.space.3',
      borderRadius: 'theme.radius.row',
      backgroundColor: 'theme.surface.fill',
      color: 'theme.ink.primary',
      textDecoration: 'none',
      fontSize: 'theme.type.small.size',
    },
    '& [data-news] a:hover': { backgroundColor: 'theme.surface.fillHover' },

    // A feature's result: a small panel drawn the way the reader meets it, in Discord or in a test.
    '& [data-result]': {
      margin: 'theme.space.4 0 0',
      padding: 'theme.space.4',
      borderRadius: 'theme.radius.callout',
      border: 'theme.line.width solid theme.line.hairline',
      backgroundColor: 'theme.surface.canvas',
      fontSize: 'theme.type.small.size',
    },
    '& [data-result-label]': {
      margin: '0 0 theme.space.3',
      fontSize: 'theme.type.caption.size',
      color: 'theme.ink.secondary',
    },
    '& [data-result-label] code': { fontFamily: 'theme.font.mono' },
    '& [data-route]': {
      display: 'grid',
      gridTemplateColumns: 'max-content minmax(0, 1fr)',
      columnGap: 'theme.space.4',
      rowGap: 'theme.space.2',
      margin: 0,
    },
    '& [data-route] dt': { color: 'theme.ink.secondary' },
    '& [data-route] dd': {
      margin: 0,
      fontFamily: 'theme.font.mono',
      fontSize: 'theme.type.control.size',
      color: 'theme.ink.primary',
      overflowWrap: 'anywhere',
    },
    '& [data-message]': { display: 'flex', gap: 'theme.space.3', alignItems: 'flex-start' },
    '& [data-avatar]': {
      flexShrink: 0,
      width: 28,
      height: 28,
      display: 'grid',
      placeItems: 'center',
      borderRadius: 'theme.radius.control',
      backgroundColor: 'theme.surface.sheet',
    },
    '& [data-who]': { display: 'flex', gap: 'theme.space.2', alignItems: 'center' },
    '& [data-who] strong': { color: 'theme.ink.primary', fontWeight: 'theme.font.weight.semibold' },
    '& [data-app]': {
      padding: '0 theme.space.1',
      borderRadius: 'theme.radius.chip',
      backgroundColor: 'theme.accent.band',
      color: 'theme.accent.default',
      fontSize: 10,
      fontWeight: 'theme.font.weight.semibold',
    },
    '& [data-private]': { fontSize: 'theme.type.caption.size', color: 'theme.ink.secondary' },
    '& [data-said]': { color: 'theme.ink.primary', overflowWrap: 'anywhere' },
    '& [data-embed]': {
      marginTop: 'theme.space.1',
      padding: 'theme.space.2 theme.space.3',
      borderRadius: 'theme.radius.chip',
      borderLeft: '4px solid var(--embed-color)',
      backgroundColor: 'theme.surface.fill',
    },
    '& [data-embed] strong': { display: 'block', color: 'theme.ink.primary' },
  },
})

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
