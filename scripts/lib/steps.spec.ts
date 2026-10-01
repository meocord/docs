import { describe, expect, it } from 'vitest'
import { excerpt } from './pages'
import { asOf, readingOrder, REPLACING_STEPS, stepIndex, stepProblems, stepsIn } from './steps'

// An app file that presenters (chapter 2) and theming (chapter 4) add to, and localisation replaces a line of.
const app = [
  "import { MeoCord } from 'meocord/decorator'",
  '// #region step:presenters',
  "import { FeedbackPresenter } from './feedback.presenter'",
  '// #endregion step:presenters',
  '',
  '// #region app',
  '@MeoCord({',
  '  controllers: [FeedbackController],',
  '  // #region step:presenters',
  '  presenter: FeedbackPresenter,',
  '  // #endregion step:presenters',
  '  // #region step:theming',
  "  theme: { colors: { primary: '#5865F2' } },",
  '  // #endregion step:theming',
  '})',
  '// #endregion app',
  "  // before:localisation description: 'Send feedback',",
  '  // #region step:localisation',
  "  description: t('feedback.description'),",
  '  // #endregion step:localisation',
].join('\n')

const code = (source: string) => source.split('\n').filter(line => !/\/\/ #(end)?region/.test(line))

describe('asOf', () => {
  it('shows a file as it stands at a page: earlier steps in, later ones out', () => {
    expect(code(asOf(app, 'slash-commands'))).toEqual([
      "import { MeoCord } from 'meocord/decorator'",
      '',
      '@MeoCord({',
      '  controllers: [FeedbackController],',
      '})',
      "  description: 'Send feedback',",
    ])
    expect(code(asOf(app, 'presenters'))).toContain('  presenter: FeedbackPresenter,')
    expect(code(asOf(app, 'presenters'))).not.toContain("  theme: { colors: { primary: '#5865F2' } },")
  })

  it('replaces a before: line from its own page on', () => {
    expect(code(asOf(app, 'theming'))).toContain("  description: 'Send feedback',")
    const localised = code(asOf(app, 'localisation'))
    expect(localised).toContain("  description: t('feedback.description'),")
    expect(localised).not.toContain("  description: 'Send feedback',")
  })

  it('is the finished file without a page: every step in, no before: line', () => {
    const finished = code(asOf(app))
    expect(finished).toContain('  presenter: FeedbackPresenter,')
    expect(finished).toContain("  description: t('feedback.description'),")
    expect(finished.some(line => line.includes('before:'))).toBe(false)
  })
})

// A controller the guards page (chapter 5) adds its imports and its decorator to.
const review = [
  "import { Command, Controller } from 'meocord/decorator'",
  '// #region step:guards',
  "import { UseGuard } from 'meocord/decorator'",
  '// #endregion step:guards',
  "import { FeedbackService } from '@src/tutorial/feedback.service'",
  '// #region step:guards',
  "import { StaffGuard } from '@src/tutorial/staff.guard'",
  '// #endregion step:guards',
  '',
  '// #region controller',
  '@Controller()',
  '// #region step:guards',
  '// Both buttons need the staff role',
  '@UseGuard(StaffGuard)',
  '// #endregion step:guards',
  'export class ReviewController {',
  '  constructor(private readonly feedback: FeedbackService) {}',
  '}',
  '// #endregion controller',
].join('\n')

describe('excerpt', () => {
  it("shows every block of a step's region in file order, with the code between them elided", () => {
    expect(excerpt(asOf(review, 'guards'), 'step:guards')).toBe(
      [
        "import { UseGuard } from 'meocord/decorator'",
        '// …',
        "import { StaffGuard } from '@src/tutorial/staff.guard'",
        '// …',
        '// Both buttons need the staff role',
        '@UseGuard(StaffGuard)',
      ].join('\n'),
    )
  })

  it('shows a region that encloses a step as it stands at the page', () => {
    expect(excerpt(asOf(review, 'guards'), 'controller')).toContain('@UseGuard(StaffGuard)')
    expect(excerpt(asOf(review, 'slash-commands'), 'controller')).toBe(
      [
        '@Controller()',
        'export class ReviewController {',
        '  constructor(private readonly feedback: FeedbackService) {}',
        '}',
      ].join('\n'),
    )
  })

  it('has no step region before its page, and none for a region the file lacks', () => {
    expect(excerpt(asOf(review, 'slash-commands'), 'step:guards')).toBeUndefined()
    expect(excerpt(review, 'nowhere')).toBeUndefined()
  })
})

describe('step marks', () => {
  it('lists the pages a file steps at, in reading order', () => {
    expect(stepsIn(app)).toEqual(['presenters', 'theming', 'localisation'])
    expect(stepIndex('presenters')! < stepIndex('theming')!).toBe(true)
    expect(readingOrder()[0]).toBe('overview')
    expect(stepIndex('nowhere')).toBeUndefined()
  })

  it('reports a page off the plan, a region opened inside another or left open or closed twice, and a replacement no page may make', () => {
    const broken = [
      '// #region step:nowhere',
      '// #region step:theming',
      '// #endregion step:theming',
      '// #endregion step:theming',
      '// before:elsewhere x',
      '// before:theming y',
      '// #region step:presenters',
    ].join('\n')
    expect(stepProblems(broken)).toEqual([
      'line 1: step "nowhere" is not a page of the Guide\'s plan',
      'line 2: step:theming opens inside step:nowhere',
      'line 4: #endregion step:theming closes no open step region',
      'line 5: step "elsewhere" is not a page of the Guide\'s plan',
      'line 6: before:theming replaces a line, which only localisation may do',
      'step:presenters is never closed',
    ])
    expect(stepProblems(app)).toEqual([])
    expect(REPLACING_STEPS).toEqual(['localisation'])
  })
})
