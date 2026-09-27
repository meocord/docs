import { ChatInputCommandInteraction } from 'discord.js'
import { createMockInteraction, inspectHandler, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { MuteSlashController } from '@src/controllers/slash/staff.slash.controller'
import { Roles, RolesGuard } from '@src/guards/roles.guard'

describe('MuteSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [MuteSlashController] }).compile()

  it("runs its base class's guard, with its base class's metadata", async () => {
    // Created without a guildId, the mock is outside a server, with no member to have the role
    const interaction = createMockInteraction(ChatInputCommandInteraction)

    await expect(module.invoke(MuteSlashController, 'mute', interaction)).resolves.toEqual({ ran: false })
    expect(inspectHandler(MuteSlashController, 'mute').guards).toEqual([RolesGuard])
    expect(inspectHandler(MuteSlashController, 'mute').get(Roles)).toEqual(['moderator'])
  })
})
