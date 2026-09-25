/**
 * The pipeline panel's behaviour, loaded on demand. It moves the call through the stages the server
 * drew, one at a time: the stage's dot settles, its line of code lights, and its sentence reads out.
 * A member's call is answered at the end; a blocked user's stops at the guard. Only attributes change,
 * and the panel's styles draw them.
 */

type Scenario = 'member' | 'blocked'

const STEP_MS = 420
const MEMBER = ['defer', 'guard', 'interceptor:before', 'pipe', 'handler', 'interceptor:after', 'respond']
const BLOCKED = ['defer', 'guard']

export function attach(panel: HTMLElement, { autoplay }: { autoplay: boolean }) {
  const rows = [...panel.querySelectorAll<HTMLElement>('[data-stage]')]
  const lines = [...panel.querySelectorAll<HTMLElement>('[data-pane="code"] .line')]
  const narration = panel.querySelector<HTMLElement>('[data-narration]')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

  let scenario: Scenario = 'member'
  let position = -1
  let timer = 0

  const path = () => (scenario === 'member' ? MEMBER : BLOCKED)

  function paint() {
    const order = path()
    const stoppedAt = scenario === 'blocked' && position >= order.length - 1 ? order.length - 1 : -1
    for (const row of rows) {
      const at = order.indexOf(row.dataset.stage ?? '')
      row.dataset.state =
        at === -1
          ? position >= order.length - 1
            ? 'skipped'
            : 'pending'
          : at === stoppedAt
            ? 'stopped'
            : at < position
              ? 'done'
              : at === position
                ? position === order.length - 1 && scenario === 'member'
                  ? 'done'
                  : 'current'
                : 'pending'
    }
    const current = rows.find(row => row.dataset.stage === order[position])
    for (const line of lines) line.removeAttribute('data-lit')
    const line = current?.dataset.line
    if (line !== undefined && lines[Number(line)])
      lines[Number(line)].dataset.lit = stoppedAt >= 0 ? 'stopped' : 'current'
    if (narration && current) narration.textContent = current.dataset.narrationText ?? ''
    const answered = position >= order.length - 1
    panel.toggleAttribute('data-answered', answered)
  }

  function stop() {
    window.clearTimeout(timer)
    timer = 0
  }

  function step() {
    if (position >= path().length - 1) position = -1
    position += 1
    paint()
  }

  function run() {
    stop()
    position = -1
    paint()
    const tick = () => {
      step()
      if (position < path().length - 1) timer = window.setTimeout(tick, reduced.matches ? 0 : STEP_MS)
      else timer = 0
    }
    timer = window.setTimeout(tick, reduced.matches ? 0 : STEP_MS / 2)
  }

  function choose(next: Scenario) {
    scenario = next
    panel.dataset.scenario = next
    run()
  }

  panel.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null
    const choice = target?.closest<HTMLElement>('[data-choose]')?.dataset.choose
    if (choice === 'member' || choice === 'blocked') return choose(choice)
    if (target?.closest('[data-run]')) return run()
    if (target?.closest('[data-step]')) {
      stop()
      step()
    }
  })

  for (const button of panel.querySelectorAll<HTMLElement>('[data-choose]')) {
    button.setAttribute('aria-pressed', String(button.dataset.choose === scenario))
  }
  panel.addEventListener('click', () => {
    for (const button of panel.querySelectorAll<HTMLElement>('[data-choose]')) {
      button.setAttribute('aria-pressed', String(button.dataset.choose === scenario))
    }
  })

  // Played once as the panel arrives, unless the reader asked for less motion.
  if (autoplay && !reduced.matches) run()
}
