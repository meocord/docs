import { A, Code, Div, Fieldset, Figure, Input, Label, Legend, Li, type NodeInstance, Ol, P, Span } from '@meonode/ui'

/** The kinds of handler a call can reach, as the pipeline figure lets a reader pick one. */
export const HANDLER_KINDS = [
  { id: 'command', label: 'Command' },
  { id: 'component', label: 'Button, select or modal' },
  { id: 'autocomplete', label: 'Autocomplete' },
  { id: 'message', label: 'Message command' },
  { id: 'message-listener', label: 'Message listener' },
  { id: 'reaction', label: 'Reaction' },
  { id: 'event', label: 'Gateway event' },
] as const

export type HandlerKind = (typeof HANDLER_KINDS)[number]['id']

const EVERY: readonly HandlerKind[] = HANDLER_KINDS.map(kind => kind.id)

/**
 * One stage of a call: what it does, the handlers it runs for, the Guide page that teaches it and the API
 * entry it is declared with, as `guide:` and `api:` links. A stage `around` others wraps them.
 */
export interface PipelineStage {
  id: string
  name: string
  what: string
  kinds: readonly HandlerKind[]
  guide: string
  api?: string
  around?: readonly PipelineStage[]
  /** What the stage does for particular kinds, where that differs: shown in place of `what` once a kind is picked. */
  byKind?: readonly { kinds: readonly HandlerKind[]; what: string }[]
}

/** The stages of a call, in the order they run, as MeoCord's dispatch runs them. */
export const PIPELINE: readonly PipelineStage[] = [
  {
    id: 'observers-start',
    name: 'Observers: onStart',
    what: 'Hear about the call before anything runs.',
    kinds: EVERY,
    guide: 'guide:observers',
    api: 'decorators/Observer',
  },
  {
    id: 'filters',
    name: 'Exception filters',
    what: 'Catch an error from any stage below, or from the handler.',
    kinds: EVERY,
    guide: 'guide:exception-filters',
    api: 'decorators/UseFilter',
    around: [
      {
        id: 'defer',
        name: '@Defer: acknowledge',
        what: "Acknowledge the interaction, so slow stages never miss Discord's three seconds.",
        kinds: ['command', 'component'],
        guide: 'guide:defer',
        api: 'decorators/Defer',
      },
      {
        id: 'parse',
        name: 'Parse',
        what: "Read a message command's words into typed params.",
        kinds: ['message'],
        guide: 'guide:message-params',
      },
      {
        id: 'guards',
        name: 'Guards',
        what: 'Decide whether the handler runs: global first, then the controller, then the method.',
        kinds: EVERY,
        guide: 'guide:guards',
        api: 'decorators/UseGuard',
      },
      {
        id: 'cooldown-check',
        name: 'Cooldown check',
        what: 'Check the cooldowns without counting the call, when the params name members, users, roles or channels Discord must fetch.',
        kinds: ['message'],
        guide: 'guide:cooldowns',
        api: 'decorators/Cooldown',
      },
      {
        id: 'fetch',
        name: 'Fetch',
        what: 'Get the members, users, roles or channels the params name that Discord must fetch.',
        kinds: ['message'],
        guide: 'guide:message-params',
      },
      {
        id: 'interceptors',
        name: 'Interceptors',
        what: 'Act before and after everything below.',
        kinds: ['command', 'component', 'message', 'message-listener', 'reaction', 'event'],
        guide: 'guide:interceptors',
        api: 'decorators/UseInterceptor',
        around: [
          {
            id: 'validation',
            name: 'Validation',
            what: "Check the handler's input against a schema.",
            kinds: ['command', 'component', 'message'],
            guide: 'guide:validation',
            api: 'decorators/Validate',
          },
          {
            id: 'pipes',
            name: 'Pipes',
            what: 'Turn the valid values into what the handler works with.',
            kinds: ['command', 'component', 'message'],
            guide: 'guide:validation',
            api: 'decorators/UsePipe',
          },
          {
            id: 'cooldowns',
            name: 'Cooldowns',
            what: 'Count the call, last, so a refused call or bad input never uses one up.',
            kinds: ['command', 'component', 'message', 'message-listener'],
            guide: 'guide:cooldowns',
            api: 'decorators/Cooldown',
          },
          {
            id: 'defer-lock',
            name: '@Defer: lock',
            what: "Lock a component's message, only once the call will run.",
            kinds: ['component'],
            guide: 'guide:defer',
            api: 'decorators/Defer',
          },
          {
            id: 'handler',
            name: 'The handler',
            what: 'Runs with what the stages produced.',
            kinds: EVERY,
            guide: 'guide:first-command',
          },
        ],
      },
      {
        id: 'fallback',
        name: 'The built-in fallback',
        what: 'Answer or log what no filter handled, as the kind of handler allows: pick one to see how.',
        kinds: EVERY,
        guide: 'guide:exception-filters#the-built-in-fallback',
        byKind: [
          {
            kinds: ['command', 'component'],
            what: "Answer a refusal, a cooldown or a user's mistake privately, in its own words or MeoCord's, and anything else as a generic error.",
          },
          { kinds: ['autocomplete'], what: 'Log the error and close the menu.' },
          {
            kinds: ['message'],
            what: "Reply with the command's usage, or why a guard or validation refused it, and to a user's mistake; skip a cooldown; log anything else.",
          },
          {
            kinds: ['message-listener'],
            what: "Reply to a user's mistake; skip a refusal or a cooldown; log anything else.",
          },
          {
            kinds: ['reaction', 'event'],
            what: "Reply to a user's mistake where there's a message to reply to, and log anything else.",
          },
        ],
      },
    ],
  },
  {
    id: 'observers-settled',
    name: 'Observers: onSettled',
    what: 'Hear how the call ended, and how long it took.',
    kinds: EVERY,
    guide: 'guide:observers',
    api: 'decorators/Observer',
  },
]

/** Every stage of the pipeline, the ones a stage wraps included, in order. */
export const everyStage = (stages: readonly PipelineStage[] = PIPELINE): PipelineStage[] =>
  stages.flatMap(stage => [stage, ...everyStage(stage.around ?? [])])

function stageItem(stage: PipelineStage, href: (url: string) => string): NodeInstance {
  return Li({
    key: stage.id,
    'data-kinds': stage.kinds.join(' '),
    'data-frame': stage.around ? true : undefined,
    children: [
      Div({
        key: 'stage',
        'data-stage': true,
        children: [
          A({ key: 'name', href: href(stage.guide), children: stage.name }),
          ...(stage.api
            ? [
                ' ',
                A({
                  key: 'api',
                  href: href(`api:${stage.api}`),
                  'data-api': true,
                  children: Code(`@${stage.api.split('/')[1]}`),
                }),
              ]
            : []),
          P(stage.what, { key: 'what', 'data-what': true }),
          ...(stage.byKind ?? []).map(({ kinds, what }) =>
            P(what, { key: kinds.join('-'), 'data-kinds': kinds.join(' ') }),
          ),
        ],
      }),
      ...(stage.around ? [Ol({ key: 'around', children: stage.around.map(inner => stageItem(inner, href)) })] : []),
    ],
  })
}

/**
 * The pipeline as a figure: every stage in order, each linked to its Guide page and API entry, the ones
 * that wrap others drawn around them. Picking a kind of handler shows only the stages it runs, in CSS,
 * so the figure needs no script and reads whole without one.
 */
export function pipelineFigure(href: (url: string) => string, key?: number): NodeInstance {
  const choice = (id: string, label: string, checked = false) =>
    Label({
      key: id,
      children: [
        Input({ key: 'input', type: 'radio', name: 'pipeline-kind', value: id, defaultChecked: checked }),
        Span(label, { key: 'label' }),
      ],
    })
  return Figure({
    key,
    'data-pipeline-figure': true,
    children: [
      Fieldset({
        key: 'kinds',
        children: [
          Legend('Show the stages for', { key: 'legend' }),
          choice('all', 'Any handler', true),
          ...HANDLER_KINDS.map(kind => choice(kind.id, kind.label)),
        ],
      }),
      Ol({
        key: 'stages',
        'aria-label': 'The stages of a call, in order',
        children: PIPELINE.map(stage => stageItem(stage, href)),
      }),
    ],
  })
}
