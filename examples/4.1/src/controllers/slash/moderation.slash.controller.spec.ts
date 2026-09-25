import { ChatInputCommandInteraction } from 'discord.js'
import {
  createExecutionContext,
  createMockInteraction,
  getResponse,
  inspectHandler,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { ModerationSlashController } from '@src/controllers/slash/moderation.slash.controller'
import { ChannelGuard } from '@src/guards/channel.guard'
import { Roles, RolesGuard } from '@src/guards/roles.guard'

describe('ModerationSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [ModerationSlashController] }).compile()

  // #region invoke
  it('runs in an allowed channel, and a guard that returns false stops it silently', async () => {
    const allowed = createMockInteraction(ChatInputCommandInteraction, { channelId: '111111111111111111' })
    const elsewhere = createMockInteraction(ChatInputCommandInteraction, { channelId: '222222222222222222' })

    await expect(module.invoke(ModerationSlashController, 'trade', allowed)).resolves.toEqual({ ran: true })
    await expect(module.invoke(ModerationSlashController, 'trade', elsewhere)).resolves.toEqual({ ran: false })
    expect(getResponse(elsewhere).sent).toBe(false)
  })
  // #endregion invoke

  // #region unit
  it('reads the roles from the handler, in a unit test of the guard', () => {
    // Created without a guildId, the mock is outside a server, with no member to have the roles
    const interaction = createMockInteraction(ChatInputCommandInteraction)
    const guard = new RolesGuard(createExecutionContext(ModerationSlashController, 'ban', { args: [interaction] }))

    expect(guard.canActivate(interaction)).toBe(false)
  })
  // #endregion unit

  // #region inspect
  it('lists what each handler is set up with', () => {
    expect(inspectHandler(ModerationSlashController, 'trade').guards).toEqual([
      { provide: ChannelGuard, params: { channelIds: ['111111111111111111'] } },
    ])
    expect(inspectHandler(ModerationSlashController, 'ban').get(Roles)).toEqual(['admin', 'moderator'])
  })
  // #endregion inspect
})
