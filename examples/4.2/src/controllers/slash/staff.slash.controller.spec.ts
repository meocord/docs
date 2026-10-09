import { ChatInputCommandInteraction, Role } from 'discord.js'
import {
  createMockGuild,
  createMockInteraction,
  createMockMember,
  createMockUser,
  inspectHandler,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { MuteSlashController } from '@src/controllers/slash/staff.slash.controller'
import { ROLE_IDS } from '@src/guards/role-ids'
import { Roles, RolesGuard } from '@src/guards/roles.guard'

describe('MuteSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [MuteSlashController] }).compile()

  it("runs its base class's guard, with its base class's metadata", async () => {
    // Created without a guildId, the mock is outside a server, with no member to have the role
    const interaction = createMockInteraction(ChatInputCommandInteraction)

    await expect(module.invoke(MuteSlashController, 'mute', interaction)).resolves.toEqual({ ran: false })
    expect(inspectHandler(MuteSlashController, 'mute').guards).toEqual([RolesGuard])
    expect(inspectHandler(MuteSlashController, 'mute').get(Roles)).toEqual([ROLE_IDS.moderator])
  })

  it('runs for a member with the moderator role, by its ID', async () => {
    const moderator = createMockInteraction(Role, { id: ROLE_IDS.moderator, name: 'moderator' })
    const user = createMockUser()
    const guild = createMockGuild({ members: [createMockMember({ user, roles: [moderator] })] })
    const interaction = createMockInteraction(ChatInputCommandInteraction, { user, guildId: guild.id, guild })

    await expect(module.invoke(MuteSlashController, 'mute', interaction)).resolves.toEqual({ ran: true })
  })
})
