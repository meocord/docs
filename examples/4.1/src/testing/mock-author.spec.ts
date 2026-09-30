import { ButtonInteraction } from 'discord.js'
import {
  createMockGuild,
  createMockInteraction,
  createMockMessage,
  createMockUser,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import App from '@src/app-message-dm'

describe('mocks from one user', () => {
  // #region author
  it('counts two messages from one author against that member’s cooldown', async () => {
    const module = MeoCordTestingModule.fromApp(App).compile()
    const ana = createMockUser()
    const first = createMockMessage({ author: ana, content: '!daily' })
    const retry = createMockMessage({ author: ana, content: '!daily' })

    await module.dispatch(first)
    await module.dispatch(retry)

    expect(first.reply).toHaveBeenCalledWith('You claimed 100 coins. Come back tomorrow.')
    // The same author, so the same member's cooldown refuses the second
    expect(retry.reply).not.toHaveBeenCalled()
  })
  // #endregion author

  // #region member
  it('gives a message and an interaction from one user in one server the same member', () => {
    const ana = createMockUser()
    const guild = createMockGuild()

    const message = createMockMessage({ author: ana, guild })
    const click = createMockInteraction(ButtonInteraction, { user: ana, guild, guildId: guild.id })

    expect(click.member).toBe(message.member)
    expect(guild.members.cache.get(ana.id)).toBe(message.member)
  })
  // #endregion member
})
