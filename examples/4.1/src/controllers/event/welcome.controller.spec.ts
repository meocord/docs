import { GuildMember } from 'discord.js'
import { createMockGuild, createMockInteraction, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { WelcomeController } from '@src/controllers/event/welcome.controller'

// #region spec
describe('WelcomeController', () => {
  const module = MeoCordTestingModule.create({ controllers: [WelcomeController] }).compile()

  it('welcomes a member who joins', async () => {
    const guild = createMockGuild()
    guild.name = 'Cat Café'
    const member = createMockInteraction(GuildMember, { guild })

    const { ran } = await module.emit('guildMemberAdd', member)

    expect(ran).toBe(1)
    expect(member.send).toHaveBeenCalledWith('Welcome to Cat Café!')
  })
})
// #endregion spec
