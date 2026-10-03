import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  botsIllustrating,
  drawnBots,
  exampleBotProblems,
  readExampleBots,
  withExampleBots,
  type ExampleBots,
} from './example-bots'

const bots = (): ExampleBots => ({
  repository: 'https://github.com/meocord/examples',
  bots: [
    {
      id: 'feedback',
      title: 'Feedback',
      shows: [
        { what: 'A guard with a reason', files: ['src/staff.guard.ts'], guide: ['guards#refusing-a-call'] },
        { what: 'A `@Defer` click', files: ['src/review.ts', 'src/post.ts'], guide: ['defer', 'recipes/tickets'] },
      ],
    },
  ],
})
const titles: Record<string, string> = { 'guards#refusing-a-call': 'Refusing a call', defer: 'Deferring a response' }
const titleOf = (ref: string) => titles[ref]

describe('withExampleBots', () => {
  it("draws a bot as its folder's link and a list of what it shows, in which files, and where the Guide teaches it", () => {
    expect(withExampleBots('Lead.\n\n::example-bot{id="feedback"}\n\nAfter.', bots(), titleOf)).toBe(
      [
        'Lead.',
        '',
        '[`feedback/` on GitHub](https://github.com/meocord/examples/tree/main/feedback)',
        '',
        '- A guard with a reason, in [`staff.guard.ts`](https://github.com/meocord/examples/blob/main/feedback/src/staff.guard.ts). See [Refusing a call](guide:guards#refusing-a-call).',
        '- A `@Defer` click, in [`review.ts`](https://github.com/meocord/examples/blob/main/feedback/src/review.ts) and [`post.ts`](https://github.com/meocord/examples/blob/main/feedback/src/post.ts). See [Deferring a response](guide:defer) and [recipes/tickets](guide:recipes/tickets).',
        '',
        'After.',
      ].join('\n'),
    )
  })

  it('leaves a directive naming no bot, and every page of a line with none, as written', () => {
    expect(withExampleBots('::example-bot{id="nope"}', bots(), titleOf)).toBe('::example-bot{id="nope"}')
    expect(withExampleBots('::example-bot{id="feedback"}', undefined, titleOf)).toBe('::example-bot{id="feedback"}')
  })
})

describe('botsIllustrating', () => {
  it('lists what each bot shows of a page, linking its section and its files, whatever anchor it names', () => {
    expect(botsIllustrating(bots(), 'guards')).toBe(
      '- [Feedback](guide:example-bots#feedback): A guard with a reason, in [`staff.guard.ts`](https://github.com/meocord/examples/blob/main/feedback/src/staff.guard.ts).',
    )
    expect(botsIllustrating(bots(), 'recipes/tickets')).toMatch(
      /^- \[Feedback\]\(guide:example-bots#feedback\): A `@Defer` click, in /,
    )
  })

  it('has nothing for a page no bot illustrates, or a line with no bots', () => {
    expect(botsIllustrating(bots(), 'services')).toBeUndefined()
    expect(botsIllustrating(undefined, 'guards')).toBeUndefined()
  })
})

describe('exampleBotProblems', () => {
  const drawn = (body = '## Feedback\n\n::example-bot{id="feedback"}', anchors = ['feedback']) => [
    { pagePath: 'example-bots', body, anchors: new Set(anchors) },
    { pagePath: 'guards', body: 'Text.', anchors: new Set<string>() },
  ]

  it('accepts each bot drawn once, under a heading of its id, on the Example bots page', () => {
    expect(exampleBotProblems('content/4.1', bots(), drawn())).toEqual([])
  })

  it("refuses a bot that isn't one folder, one line of text per item, a file outside it, or a page by path", () => {
    const list = bots()
    list.repository = 'https://example.com/examples'
    list.bots.push(
      { id: 'Feedback_2', title: ' ', shows: [] },
      { id: 'feedback', title: 'Again', shows: [{ what: 'A guard', files: ['a.ts'], guide: ['guards'] }] },
    )
    list.bots[0]!.shows.push({ what: 'a\nb', files: [], guide: [] })
    list.bots[0]!.shows.push({ what: 'Files', files: ['../secret.ts', '/abs.ts'], guide: ['/docs/4.1/guards', 'a#B'] })
    const where = 'content/4.1/example-bots.json'
    expect(exampleBotProblems('content/4.1', list, drawn('## Feedback\n\n::example-bot{id="feedback"}'))).toEqual([
      `${where}: repository is not a GitHub repository's URL`,
      `${where}: bot "feedback": "a\nb" is not one line of text`,
      `${where}: bot "feedback": "a\nb" names no file`,
      `${where}: bot "feedback": "a\nb" names no Guide page`,
      `${where}: bot "feedback": ../secret.ts is not a path inside the bot's folder`,
      `${where}: bot "feedback": /abs.ts is not a path inside the bot's folder`,
      `${where}: bot "feedback": "/docs/4.1/guards" is not a Guide page's path, with an optional #anchor`,
      `${where}: bot "feedback": "a#B" is not a Guide page's path, with an optional #anchor`,
      `${where}: bot "Feedback_2": its id is not a folder name in kebab case`,
      `${where}: bot "Feedback_2" has no title`,
      `${where}: bot "Feedback_2" shows nothing`,
      `${where}: bot "feedback" is listed twice`,
      `${where}: bot "Feedback_2" is drawn 0 times; example-bots draws it once`,
    ])
  })

  it('refuses a directive on another page or naming no bot, a bot drawn twice or never, and one with no heading', () => {
    const pages = drawn('::example-bot{id="feedback"}\n\n::example-bot{id="feedback"}\n::example-bot{id="nope"}', [])
    pages[1]!.body = '::example-bot{id="feedback"}'
    expect(exampleBotProblems('content/4.1', bots(), pages)).toEqual([
      'content/4.1/example-bots.md: ::example-bot{id="nope"} names no bot of content/4.1/example-bots.json',
      'content/4.1/guards.md: ::example-bot{id="feedback"} belongs on example-bots',
      'content/4.1/example-bots.json: bot "feedback" is drawn 3 times; example-bots draws it once',
      'content/4.1/example-bots.md: no heading has the anchor #feedback, which links bot "feedback"',
    ])
    expect(drawnBots('Text ::example-bot{id="inline"}\n::example-bot{id="a"}  ')).toEqual(['a'])
  })
})

describe('readExampleBots', () => {
  it("reads a Guide folder's list, and nothing from a folder without one", () => {
    const folder = mkdtempSync(path.join(tmpdir(), 'example-bots-'))
    expect(readExampleBots(folder)).toBeUndefined()
    writeFileSync(path.join(folder, 'example-bots.json'), JSON.stringify(bots()))
    expect(readExampleBots(folder)).toEqual(bots())
  })
})
