import { ChatInputCommandInteraction } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import { createMockInteraction, createMockUser, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { GiveawaySlashController } from '@src/controllers/slash/giveaway.slash.controller'
import { MIN_ACCOUNT_AGE } from '@src/guards/account-age.guard'

describe('GiveawaySlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [GiveawaySlashController] }).compile()

  // A call from a user whose account was made the given time ago
  const fromAccountAged = (age: number) =>
    createMockInteraction(ChatInputCommandInteraction, { user: createMockUser({ createdTimestamp: Date.now() - age }) })

  it('lets an account old enough enter', async () => {
    const interaction = fromAccountAged(MIN_ACCOUNT_AGE * 2)

    await expect(module.invoke(GiveawaySlashController, 'enter', interaction)).resolves.toEqual({ ran: true })
    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'You are in the giveaway. Good luck!' })
  })

  it('refuses a new account, and says why', async () => {
    const interaction = fromAccountAged(60 * 60 * 1000)

    await expect(module.invoke(GiveawaySlashController, 'enter', interaction)).rejects.toThrow(
      new GuardDeniedError('Your account must be at least a week old to use this.'),
    )
    expect(getResponse(interaction).sent).toBe(false)
  })
})
