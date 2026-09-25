import { ChatInputCommandInteraction, User } from 'discord.js'
import { createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { ProfileSlashController } from '@src/controllers/slash/profile.slash.controller'

describe('ProfileSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [ProfileSlashController] }).compile()

  it('defers, edits the deferred reply, then follows up privately', async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction, {
      user: createMockInteraction(User, { username: 'ada' }),
    })

    await module.invoke(ProfileSlashController, 'profile', interaction)

    expect(getResponse(interaction).calls.map(call => call.method)).toEqual(['deferReply', 'editReply', 'followUp'])
  })
})
