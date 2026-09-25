import { ChatInputCommandInteraction } from 'discord.js'
import { createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { QuoteSlashController } from '@src/controllers/slash/quote.slash.controller'
import { RateLimitedError } from '@src/filters/rate-limited.filter'

describe('QuoteSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [QuoteSlashController] }).compile()

  // #region spec
  it('answers the error its filter handles, and invoke reports it handled', async () => {
    await module.invoke(QuoteSlashController, 'quote', createMockInteraction(ChatInputCommandInteraction))
    const limited = createMockInteraction(ChatInputCommandInteraction)

    const result = await module.invoke(QuoteSlashController, 'quote', limited)

    expect(result.error).toBeInstanceOf(RateLimitedError)
    expect(getResponse(limited).calls.map(call => call.method)).toEqual(['reply'])
  })
  // #endregion spec
})
