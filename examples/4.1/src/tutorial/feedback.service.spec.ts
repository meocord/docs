import { Locale } from 'discord.js'
import { describe, expect, it } from 'vitest'
import { FeedbackNotFoundError } from '@src/tutorial/feedback.errors'
import { FeedbackService } from '@src/tutorial/feedback.service'

// #region spec
describe('FeedbackService', () => {
  const entry = { authorId: '111', locale: Locale.EnglishUS, about: 'Music bot', details: 'It skips songs.' }

  it('numbers feedback as it arrives, and records a decision', () => {
    const service = new FeedbackService()
    const first = service.add(entry)
    const second = service.add({ ...entry, about: 'Events' })

    expect([first.id, second.id]).toEqual(['1', '2'])
    expect(first.status).toBe('open')
    expect(service.decide('2', 'approved')).toMatchObject({ about: 'Events', status: 'approved' })
  })

  it('refuses an id it does not hold', () => {
    expect(() => new FeedbackService().decide('9', 'rejected')).toThrow(FeedbackNotFoundError)
  })
})
// #endregion spec
