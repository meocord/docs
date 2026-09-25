import { Button, Code, createNode, Div, H2, H3, Li, Node, Ol, P, Small, Span, Strong } from '@meonode/ui'
import { markSvgNode } from '@/components/home/mark-node'
import { PipelineIsland } from '@/components/home/PipelineIsland'
import { hitAreaCss } from '@/lib/design/css'
import { codeFrame } from '@/lib/prose/code'
import type { PipelineDemo } from '@/lib/home/data'

/**
 * The home page's pipeline, as a native app panel: a channel where the command is used, the example
 * that answers it, and a trace of the stages the call passes through.
 *
 * The first paint is the finished run for a member, in HTML, the same for every reader. Every other
 * state is an attribute: `data-scenario` on the panel, `data-state` on each stage, `data-lit` on a
 * line of code, set by a small island loaded when the panel comes near. The styles here draw them.
 */
const Panel = createNode('section', {
  display: 'flex',
  flexDirection: 'column',
  margin: '0 0 theme.space.16',
  borderRadius: 'theme.radius.code',
  border: 'theme.line.width solid theme.line.hairline',
  backgroundColor: 'theme.surface.canvas',
  boxShadow: 'theme.elevation.2',
  overflow: 'hidden',
  // The bar's layout follows the panel's width, which never waits on what is inside it.
  containerType: 'inline-size',
  css: {
    // The panel's toolbar: the title, then a column for each control, in their order, sized before any is
    // drawn, so a page painted before the bar has all arrived draws each control where it stays. The
    // minimums are the controls' widths in the site's type; e2e/home.spec.ts checks they still fit.
    '& [data-bar]': {
      '--bar-choose': '182px',
      '--bar-step': '52px',
      '--bar-run': '89px',
      display: 'grid',
      gridTemplateColumns:
        'minmax(0, 1fr) minmax(var(--bar-choose), auto) minmax(var(--bar-step), auto) minmax(var(--bar-run), auto)',
      alignItems: 'center',
      gap: 'theme.space.3',
      minHeight: 44,
      padding: 'theme.space.2 theme.space.2 theme.space.2 theme.space.4',
      borderBottom: 'theme.line.width solid theme.line.hairline',
    },
    // Each control keeps its own width in its column, as it did in a row; the title fills its own.
    '& [data-bar] > :not(h2)': { justifySelf: 'start' },
    // Too narrow for one row: the title above, the controls beneath it from the left.
    '@container (width < 580px)': {
      '& [data-bar]': {
        gridTemplateColumns:
          'minmax(var(--bar-choose), auto) minmax(var(--bar-step), auto) minmax(var(--bar-run), auto) minmax(0, 1fr)',
      },
      '& [data-bar] h2': { gridColumn: '1 / -1' },
    },
    // Too narrow for the three controls in a row: Run beneath the other two.
    '@container (width < 376px)': {
      '& [data-bar]': {
        gridTemplateColumns: 'minmax(var(--bar-choose), auto) minmax(var(--bar-step), auto) minmax(0, 1fr)',
      },
      '& [data-run]': { gridColumn: '1' },
    },
    '& [data-bar] h2': {
      margin: 0,
      fontSize: 'theme.type.small.size',
      fontWeight: 'theme.font.weight.semibold',
      color: 'theme.ink.primary',
    },
    '& [data-segments]': {
      display: 'inline-flex',
      padding: 2,
      gap: 2,
      borderRadius: 'theme.radius.control',
      backgroundColor: 'theme.surface.fill',
    },
    '& button': {
      ...hitAreaCss,
      height: 26,
      padding: '0 theme.space.3',
      border: 'none',
      borderRadius: 'theme.radius.control',
      backgroundColor: 'transparent',
      color: 'theme.ink.secondary',
      fontFamily: 'inherit',
      fontSize: 'theme.type.control.size',
      cursor: 'pointer',
      transitionProperty: 'background-color, color',
      transitionDuration: 'theme.motion.duration.state',
    },
    '& button:hover': { color: 'theme.ink.primary' },
    '& button:focus-visible': { outline: 'theme.focus.width solid theme.accent.default', outlineOffset: 1 },
    '& [data-segments] button': { height: 22, borderRadius: 4 },
    '&:not([data-scenario="blocked"]) [data-choose="member"], &[data-scenario="blocked"] [data-choose="blocked"]': {
      backgroundColor: 'theme.surface.sheet',
      color: 'theme.ink.primary',
      boxShadow: 'theme.elevation.1',
    },
    '& [data-step]': {
      backgroundColor: 'theme.surface.sheet',
      color: 'theme.ink.primary',
      boxShadow: 'theme.elevation.1',
    },
    '& [data-run]': {
      backgroundColor: 'theme.accent.default',
      color: 'theme.accent.content',
      fontWeight: 'theme.font.weight.semibold',
    },
    '& [data-run]:hover': { backgroundColor: 'theme.accent.hover', color: 'theme.accent.content' },

    // The code across the top, where the whole example fits; the channel and the trace beneath it, side
    // by side, then stacked on a phone.
    '& [data-panes]': {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      gridTemplateAreas: '"code code" "channel trace"',
    },
    '& [data-pane="code"]': { gridArea: 'code', borderBottom: 'theme.line.width solid theme.line.hairline' },
    '& [data-pane]': { minWidth: 0 },

    // The channel.
    '& [data-pane="channel"]': {
      gridArea: 'channel',
      borderRight: 'theme.line.width solid theme.line.hairline',
      display: 'flex',
      flexDirection: 'column',
      gap: 'theme.space.3',
      padding: 'theme.space.4',
    },
    '& [data-channel-name]': { fontSize: 'theme.type.caption.size', color: 'theme.ink.secondary' },
    '& [data-message]': { display: 'flex', gap: 'theme.space.3', alignItems: 'flex-start' },
    '& [data-avatar]': {
      flexShrink: 0,
      width: 28,
      height: 28,
      borderRadius: '50%',
      backgroundColor: 'theme.surface.fillHover',
    },
    '& [data-avatar="bot"]': {
      borderRadius: 'theme.radius.control',
      display: 'grid',
      placeItems: 'center',
      backgroundColor: 'theme.surface.sheet',
    },
    '& [data-who]': { display: 'flex', gap: 'theme.space.2', alignItems: 'center', fontSize: 'theme.type.small.size' },
    '& [data-who] strong': { color: 'theme.ink.primary', fontWeight: 'theme.font.weight.semibold' },
    '& [data-who] small': { color: 'theme.ink.secondary', fontSize: 'theme.type.caption.size' },
    '& [data-app]': {
      padding: '0 theme.space.1',
      borderRadius: 'theme.radius.chip',
      backgroundColor: 'theme.accent.band',
      color: 'theme.accent.default',
      fontSize: 10,
      fontWeight: 'theme.font.weight.semibold',
    },
    '& [data-said]': { fontSize: 'theme.type.small.size', color: 'theme.ink.primary', overflowWrap: 'anywhere' },
    '& [data-said] code': {
      fontFamily: 'theme.font.mono',
      fontSize: 'theme.type.control.size',
      color: 'theme.ink.secondary',
      whiteSpace: 'pre',
    },
    '& [data-private]': { fontSize: 'theme.type.caption.size', color: 'theme.ink.secondary' },
    // Which reply shows follows the scenario and whether the call has been answered.
    '& [data-reply]': { display: 'none' },
    '&:not([data-scenario="blocked"])[data-answered] [data-reply="member"], &[data-scenario="blocked"][data-answered] [data-reply="blocked"]':
      {
        display: 'flex',
        animation: 'arrive theme.motion.duration.open theme.motion.ease.enter',
      },
    '&:not([data-answered]) [data-reply="thinking"]': { display: 'flex' },
    '& [data-thinking]': { color: 'theme.ink.secondary', fontStyle: 'italic' },
    '@keyframes arrive': { from: { opacity: 0, transform: 'translateY(4px)' } },

    // The code: the example's region, highlighted as the docs highlight it; the current line is lit.
    '& [data-pane="code"] [data-code]': { margin: 0, border: 'none', borderRadius: 0, backgroundColor: 'transparent' },
    '& [data-pane="code"] pre': { padding: 'theme.space.3 0' },
    // Lines as rows, so a lit line spans the pane; whitespace between them is not drawn in a flex column.
    '& [data-pane="code"] pre code': { display: 'flex', flexDirection: 'column', minWidth: 'max-content' },
    '& [data-pane="code"] .line': {
      minHeight: '1lh',
      padding: '0 theme.space.4',
      borderLeft: '2px solid transparent',
      transitionProperty: 'background-color, border-color',
      transitionDuration: 'theme.motion.duration.state',
    },
    '& [data-pane="code"] .line[data-lit]': {
      backgroundColor: 'theme.accent.band',
      borderLeftColor: 'theme.accent.default',
    },
    '& [data-pane="code"] .line[data-lit="stopped"]': {
      backgroundColor: 'theme.callout.danger.fill',
      borderLeftColor: 'theme.callout.danger.glyph',
    },

    // The trace.
    '& [data-pane="trace"]': {
      gridArea: 'trace',
      display: 'flex',
      flexDirection: 'column',
      padding: 'theme.space.3 theme.space.2',
    },
    '& [data-pane="trace"] h3': {
      margin: '0 0 theme.space.1',
      padding: '0 theme.space.2',
      fontSize: 'theme.type.caption.size',
      fontWeight: 'theme.font.weight.semibold',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: 'theme.ink.secondary',
    },
    '& ol': { margin: 0, padding: 0, listStyle: 'none' },
    '& [data-stage]': {
      display: 'grid',
      gridTemplateColumns: '8px minmax(0, 1fr)',
      columnGap: 'theme.space.3',
      alignItems: 'baseline',
      padding: '5px theme.space.2',
      borderRadius: 'theme.radius.row',
      transitionProperty: 'background-color',
      transitionDuration: 'theme.motion.duration.state',
    },
    '& [data-dot]': {
      width: 8,
      height: 8,
      borderRadius: '50%',
      alignSelf: 'center',
      backgroundColor: 'theme.ink.quiet',
      transitionProperty: 'background-color, box-shadow, transform',
      transitionDuration: 'theme.motion.duration.open',
      transitionTimingFunction: 'theme.motion.ease.enter',
    },
    '& [data-stage-name]': {
      fontFamily: 'theme.font.mono',
      fontSize: 'theme.type.control.size',
      color: 'theme.ink.primary',
      overflowWrap: 'anywhere',
    },
    '& [data-note]': {
      gridColumn: 2,
      fontSize: 'theme.type.caption.size',
      color: 'theme.ink.secondary',
      overflowWrap: 'anywhere',
      // The recorded value, spaces and all.
      whiteSpace: 'pre-wrap',
    },
    '& [data-note] [data-for="blocked"]': { display: 'none' },
    '&[data-scenario="blocked"] [data-note] [data-for="member"]': { display: 'none' },
    '&[data-scenario="blocked"] [data-note] [data-for="blocked"]': { display: 'inline' },
    '& [data-stage][data-state="done"] [data-dot]': { backgroundColor: 'theme.callout.tip.glyph' },
    '& [data-stage][data-state="current"]': { backgroundColor: 'theme.accent.tint' },
    '& [data-stage][data-state="current"] [data-dot]': {
      backgroundColor: 'theme.accent.default',
      transform: 'scale(1.25)',
    },
    '& [data-stage][data-state="stopped"]': { backgroundColor: 'theme.callout.danger.fill' },
    '& [data-stage][data-state="stopped"] [data-dot]': { backgroundColor: 'theme.callout.danger.glyph' },
    // Not run yet, or not reached: a hollow dot and the secondary ink, which stays readable.
    '& [data-stage][data-state="pending"] [data-stage-name], & [data-stage][data-state="skipped"] [data-stage-name]': {
      color: 'theme.ink.secondary',
    },
    '& [data-stage][data-state="pending"] [data-dot], & [data-stage][data-state="skipped"] [data-dot]': {
      backgroundColor: 'transparent',
      boxShadow: 'inset 0 0 0 1.5px theme.ink.quiet',
    },
    '& [data-narration-box]': { display: 'grid', margin: 'auto 0 theme.space.4' },
    '& [data-narration-box] > p': { gridArea: '1 / 1', margin: 0 },
    '& [data-narration-sizer]': { visibility: 'hidden' },
    '& [data-narration], & [data-narration-sizer]': {
      padding: 'theme.space.3 theme.space.2 theme.space.1',
      fontSize: 'theme.type.small.size',
      lineHeight: 'theme.type.small.line',
      color: 'theme.ink.secondary',
    },
    // On a phone the panes stack: code, then the channel, then the trace.
    '@media (width < theme.breakpoint.compact)': {
      '& [data-panes]': { gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateAreas: '"code" "channel" "trace"' },
      '& [data-pane="channel"]': { borderRight: 'none', borderBottom: 'theme.line.width solid theme.line.hairline' },
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& *': { transitionDuration: '0s !important', animation: 'none !important' },
    },
  },
})

function stageRow({ id, line, narration, name, member, blocked }: PipelineDemo['stages'][number]) {
  return Li({
    key: id,
    'data-stage': id,
    'data-state': 'done',
    'data-line': line,
    'data-narration-text': narration,
    children: [
      Span(null, { key: 'dot', 'data-dot': true, 'aria-hidden': true }),
      Span(name, { key: 'name', 'data-stage-name': true }),
      Span(
        [
          Span(member, { key: 'member', 'data-for': 'member' }),
          Span(blocked, { key: 'blocked', 'data-for': 'blocked' }),
        ],
        { key: 'note', 'data-note': true },
      ),
    ],
  })
}

function reply(kind: 'thinking' | 'member' | 'blocked', demo: PipelineDemo) {
  const said =
    kind === 'thinking'
      ? Div({ 'data-said': true, 'data-thinking': true, children: 'greeter is thinking…' })
      : kind === 'member'
        ? Div({ 'data-said': true, children: demo.memberReply })
        : Div({
            'data-said': true,
            children: [
              Div({ key: 'private', 'data-private': true, children: 'Only you can see this' }),
              Div({ key: 'reason', children: demo.blockedReply }),
            ],
          })
  return Div({
    key: kind,
    'data-message': true,
    'data-reply': kind,
    children: [
      Div({ key: 'avatar', 'data-avatar': 'bot', 'aria-hidden': true, children: markSvgNode(18) }),
      Div({
        key: 'body',
        children: [
          Div({
            key: 'who',
            'data-who': true,
            children: [Strong('greeter', { key: 'n' }), Span('APP', { key: 'a', 'data-app': true })],
          }),
          said,
        ],
      }),
    ],
  })
}

/** The pipeline panel, drawn complete for a member; the island makes it play. */
export function PipelinePanel(demo: PipelineDemo) {
  return Panel({
    'data-pipeline': true,
    'data-answered': true,
    'aria-labelledby': 'pipeline-title',
    children: [
      Div({
        key: 'bar',
        'data-bar': true,
        children: [
          H2('One call, through the pipeline', { key: 'title', id: 'pipeline-title' }),
          Div({
            key: 'who',
            role: 'group',
            'aria-label': 'Who uses the command',
            'data-segments': true,
            children: [
              Button('Member', { key: 'm', type: 'button', 'data-choose': 'member' }),
              Button('Blocked user', { key: 'b', type: 'button', 'data-choose': 'blocked' }),
            ],
          }),
          Button('Step', { key: 'step', type: 'button', 'data-step': true }),
          Button(`Run ${demo.command}`, { key: 'run', type: 'button', 'data-run': true }),
        ],
      }),
      Div({
        key: 'panes',
        'data-panes': true, // In the order they are drawn, so a page painted before it has all arrived draws each pane
        // where it stays.
        children: [
          Div({ key: 'code', 'data-pane': 'code', children: codeFrame(demo.source, 'ts', { file: demo.file }) }),
          Div({
            key: 'channel',
            'data-pane': 'channel',
            children: [
              Div({ key: 'name', 'data-channel-name': true, children: '# general' }),
              Div({
                key: 'used',
                'data-message': true,
                children: [
                  Div({ key: 'avatar', 'data-avatar': 'user', 'aria-hidden': true }),
                  Div({
                    key: 'body',
                    children: [
                      Div({
                        key: 'who',
                        'data-who': true,
                        children: [Strong('ada', { key: 'n' }), Small(`used ${demo.command}`, { key: 's' })],
                      }),
                      Div({ key: 'said', 'data-said': true, children: Code(`${demo.command} name:${demo.option}`) }),
                    ],
                  }),
                ],
              }),
              reply('thinking', demo),
              reply('member', demo),
              reply('blocked', demo),
            ],
          }),
          Div({
            key: 'trace',
            'data-pane': 'trace',
            children: [
              H3('Trace', { key: 'h' }),
              Ol({ key: 'stages', children: demo.stages.map(stageRow) }),
              // Each stage's sentence laid under the one shown, unseen, so the trace stands as tall as
              // its longest and nothing moves as the call steps through.
              Div({
                key: 'narration',
                'data-narration-box': true,
                children: [
                  P(demo.stages.at(-1)?.narration, { key: 'live', 'data-narration': true, 'aria-live': 'polite' }),
                  ...demo.stages.map(({ id, narration }) =>
                    P(narration, { key: id, 'data-narration-sizer': true, 'aria-hidden': true }),
                  ),
                ],
              }),
            ],
          }),
        ],
      }),
      Node(PipelineIsland, { key: 'island' }),
    ],
  })
}
