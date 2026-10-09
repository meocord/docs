import { ChatInputCommandInteraction, PermissionFlagsBits, PermissionsBitField } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { SayController } from '@src/security/say.controller'

// #region spec
describe('SayController', () => {
  const module = MeoCordTestingModule.create({ controllers: [SayController] }).compile()
  const say = (permissions: bigint[]) =>
    createMockInteraction(ChatInputCommandInteraction, {
      guildId: '1',
      memberPermissions: new PermissionsBitField(permissions),
      options: createChatInputOptions({ message: '@everyone free nitro' }),
    })

  it('posts the text without pinging anyone', async () => {
    const interaction = say([PermissionFlagsBits.ManageMessages])

    await module.invoke(SayController, 'say', interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({
      content: '@everyone free nitro',
      allowedMentions: { parse: [] },
    })
  })

  it('refuses a member without Manage Messages, even where a server has opened the command to them', async () => {
    const interaction = say([])

    await expect(module.invoke(SayController, 'say', interaction)).rejects.toThrow(GuardDeniedError)
    expect(getResponse(interaction).calls).toEqual([])
  })
})
// #endregion spec
