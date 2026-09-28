import {
  ChatInputCommandInteraction,
  Collection,
  type GuildMember,
  type GuildMemberRoleManager,
  type Role,
} from 'discord.js'
import {
  createExecutionContext,
  createMock,
  createMockGuild,
  createMockInteraction,
  getResponse,
  inspectHandler,
  MeoCordTestingModule,
} from 'meocord/testing'
import { UseGuard } from 'meocord/decorator'
import { describe, expect, it } from 'vitest'
import { ModerationSlashController } from '@src/controllers/slash/moderation.slash.controller'
import { ChannelGuard } from '@src/guards/channel.guard'
import { ROLE_IDS } from '@src/guards/role-ids'
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

  // #region typed
  it('checks the params given to a guard against the ones it declares', () => {
    // @ts-expect-error channelId is not one of ChannelGuard's params
    expect(() => UseGuard({ provide: ChannelGuard, params: { channelId: '111111111111111111' } })).not.toThrow()
  })
  // #endregion typed

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
    expect(inspectHandler(ModerationSlashController, 'ban').get(Roles)).toEqual([ROLE_IDS.admin, ROLE_IDS.moderator])
  })
  // #endregion inspect

  // A call from a server member with the given roles, in its roles cache by ID, as discord.js keeps them
  const fromMember = (...roles: Role[]) => {
    const guild = createMockGuild({ id: '444444444444444444', roles })
    const member = createMock<GuildMember>({
      roles: createMock<GuildMemberRoleManager>({ cache: new Collection(roles.map(role => [role.id, role])) }),
    })
    return createMockInteraction(ChatInputCommandInteraction, { guildId: guild.id, guild, member })
  }

  it("lets in a member with a required role's ID, and no one for a role that only has its name", async () => {
    const moderator = createMock<Role>({ id: ROLE_IDS.moderator, name: 'moderator' })
    const renamed = createMock<Role>({ id: '555555555555555555', name: 'moderator' })

    await expect(module.invoke(ModerationSlashController, 'ban', fromMember(moderator))).resolves.toEqual({ ran: true })
    await expect(module.invoke(ModerationSlashController, 'ban', fromMember(renamed))).resolves.toEqual({ ran: false })
  })
})
