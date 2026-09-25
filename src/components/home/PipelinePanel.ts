import { createNode, Node } from '@meonode/ui'
import { markSvgNode } from '@/components/home/mark-node'
import { PipelineIsland } from '@/components/home/PipelineIsland'
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
  css: {
    // The panel's toolbar.
    '& [data-bar]': {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 'theme.space.3',
      minHeight: 44,
      padding: 'theme.space.2 theme.space.2 theme.space.2 theme.space.4',
      borderBottom: 'theme.line.width solid theme.line.hairline',
    },
    '& [data-bar] h2': {
      margin: 0,
      flexGrow: 1,
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
    '& [data-narration]': {
      marginTop: 'auto',
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

function stageRow(stage: PipelineDemo['stages'][number]) {
  return Node('li', {
    key: stage.id,
    'data-stage': stage.id,
    'data-state': 'done',
    'data-line': stage.line,
    'data-narration-text': stage.narration,
    children: [
      Node('span', { key: 'dot', 'data-dot': true, 'aria-hidden': true }),
      Node('span', { key: 'name', 'data-stage-name': true, children: stage.name }),
      Node('span', {
        key: 'note',
        'data-note': true,
        children: [
          Node('span', { key: 'member', 'data-for': 'member', children: stage.member }),
          Node('span', { key: 'blocked', 'data-for': 'blocked', children: stage.blocked }),
        ],
      }),
    ],
  })
}

function reply(kind: 'thinking' | 'member' | 'blocked', demo: PipelineDemo) {
  const said =
    kind === 'thinking'
      ? Node('div', { 'data-said': true, 'data-thinking': true, children: 'greeter is thinking…' })
      : kind === 'member'
        ? Node('div', { 'data-said': true, children: demo.memberReply })
        : Node('div', {
            'data-said': true,
            children: [
              Node('div', { key: 'private', 'data-private': true, children: 'Only you can see this' }),
              Node('div', { key: 'reason', children: demo.blockedReply }),
            ],
          })
  return Node('div', {
    key: kind,
    'data-message': true,
    'data-reply': kind,
    children: [
      Node('div', { key: 'avatar', 'data-avatar': 'bot', 'aria-hidden': true, children: markSvgNode(18) }),
      Node('div', {
        key: 'body',
        children: [
          Node('div', {
            key: 'who',
            'data-who': true,
            children: [
              Node('strong', { key: 'n', children: 'greeter' }),
              Node('span', { key: 'a', 'data-app': true, children: 'APP' }),
            ],
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
      Node('div', {
        key: 'bar',
        'data-bar': true,
        children: [
          Node('h2', { key: 'title', id: 'pipeline-title', children: 'One call, through the pipeline' }),
          Node('div', {
            key: 'who',
            role: 'group',
            'aria-label': 'Who uses the command',
            'data-segments': true,
            children: [
              Node('button', { key: 'm', type: 'button', 'data-choose': 'member', children: 'Member' }),
              Node('button', { key: 'b', type: 'button', 'data-choose': 'blocked', children: 'Blocked user' }),
            ],
          }),
          Node('button', { key: 'step', type: 'button', 'data-step': true, children: 'Step' }),
          Node('button', { key: 'run', type: 'button', 'data-run': true, children: `Run ${demo.command}` }),
        ],
      }),
      Node('div', {
        key: 'panes',
        'data-panes': true,
        children: [
          Node('div', {
            key: 'channel',
            'data-pane': 'channel',
            children: [
              Node('div', { key: 'name', 'data-channel-name': true, children: '# general' }),
              Node('div', {
                key: 'used',
                'data-message': true,
                children: [
                  Node('div', { key: 'avatar', 'data-avatar': 'user', 'aria-hidden': true }),
                  Node('div', {
                    key: 'body',
                    children: [
                      Node('div', {
                        key: 'who',
                        'data-who': true,
                        children: [
                          Node('strong', { key: 'n', children: 'ada' }),
                          Node('small', { key: 's', children: `used ${demo.command}` }),
                        ],
                      }),
                      Node('div', {
                        key: 'said',
                        'data-said': true,
                        children: Node('code', { children: `${demo.command} name:${demo.option}` }),
                      }),
                    ],
                  }),
                ],
              }),
              reply('thinking', demo),
              reply('member', demo),
              reply('blocked', demo),
            ],
          }),
          Node('div', {
            key: 'code',
            'data-pane': 'code',
            children: codeFrame(demo.source, 'ts', { file: demo.file }),
          }),
          Node('div', {
            key: 'trace',
            'data-pane': 'trace',
            children: [
              Node('h3', { key: 'h', children: 'Trace' }),
              Node('ol', { key: 'stages', children: demo.stages.map(stageRow) }),
              Node('p', {
                key: 'narration',
                'data-narration': true,
                'aria-live': 'polite',
                children: demo.stages.at(-1)?.narration,
              }),
            ],
          }),
        ],
      }),
      Node(PipelineIsland, { key: 'island' }),
    ],
  })
}
