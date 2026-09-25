import { createNode, Node } from '@meonode/ui'
import { codeFrame } from '@/lib/prose/code'
import type { Claim } from '@/lib/home/data'

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
    '& [data-more]': { fontSize: 'theme.type.small.size' },

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
  },
})

export function WhySection(claims: Claim[]) {
  return Node('section', {
    key: 'why',
    'aria-labelledby': 'why',
    children: [
      Node('h2', { key: 'h', id: 'why', children: 'Why MeoCord' }),
      ...claims.map((claim, index) =>
        Node('div', {
          key: index,
          'data-row': true,
          children: [
            Node('div', {
              key: 'text',
              children: [
                Node('h3', { key: 'h', children: claim.title }),
                Node('p', { key: 'p', children: claim.body }),
                Node('a', { key: 'a', 'data-more': true, href: claim.href, children: 'Read the guide' }),
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
    Node('li', {
      key,
      children: Node('div', {
        children: [Node('p', { key: 'p', children: text }), codeFrame(code, language, { key: 1 })],
      }),
    })
  return Node('section', {
    key: 'start',
    'aria-labelledby': 'start',
    children: [
      Node('h2', { key: 'h', id: 'start', children: 'Start in three steps' }),
      Node('ol', {
        key: 'steps',
        'data-steps': true,
        children: [
          step(1, 'Create a bot. The CLI asks which package manager to use.', 'npx meocord create my-bot', 'shell'),
          step(2, 'Give it its token, in .env beside meocord.config.ts.', 'DISCORD_TOKEN=your-bot-token', 'dotenv'),
          step(3, 'Run it, rebuilding as you save.', 'npx meocord start --dev', 'shell'),
        ],
      }),
      Node('a', { key: 'more', 'data-more': true, href: guideHref, children: 'Read the quick start' }),
    ],
  })
}

export function TestingSection(spec: { file: string; code: string; report: string[] }, href: string) {
  const output = [
    Node('span', { key: 'file', 'data-pass': true, children: `✓ ${spec.file}` }),
    `  (${spec.report.length} ${spec.report.length === 1 ? 'test' : 'tests'})\n`,
    ...spec.report.map((line, index) => Node('span', { key: `t${index}`, children: `  ✓ ${line}\n` })),
    '\n',
    Node('span', { key: 'sum', children: `Test Files  ` }),
    Node('span', { key: 'p', 'data-pass': true, children: '1 passed' }),
    `\n     Tests  `,
    Node('span', { key: 'p2', 'data-pass': true, children: `${spec.report.length} passed` }),
  ]
  return Node('section', {
    key: 'testing',
    'aria-labelledby': 'testing',
    children: [
      Node('h2', { key: 'h', id: 'testing', children: 'Tested the way it runs' }),
      Node('div', {
        key: 'row',
        'data-row': true,
        children: [
          Node('div', {
            key: 'text',
            children: [
              Node('p', {
                key: 'p',
                children:
                  'This spec is the one the docs run against every build. invoke() takes the call through the same stages dispatch does, so the order it asserts is the order your bot runs.',
              }),
              Node('a', { key: 'a', 'data-more': true, href, children: 'Read about testing' }),
            ],
          }),
          Node('div', {
            key: 'code',
            children: [
              codeFrame(spec.code, 'ts', { key: 0, file: spec.file }),
              Node('pre', { key: 'out', 'data-run-output': true, 'aria-label': 'Vitest output', children: output }),
            ],
          }),
        ],
      }),
    ],
  })
}

export function NewSection(line: string, items: { title: string; href: string }[], href: string) {
  return Node('section', {
    key: 'new',
    'aria-labelledby': 'new',
    children: [
      Node('h2', { key: 'h', id: 'new', children: `New in ${line}` }),
      Node('ul', {
        key: 'items',
        'data-news': true,
        children: items.map(item =>
          Node('li', { key: item.href, children: Node('a', { href: item.href, children: item.title }) }),
        ),
      }),
      Node('p', {
        key: 'more',
        children: Node('a', { 'data-more': true, href, children: `Read what’s new in ${line}` }),
      }),
    ],
  })
}
