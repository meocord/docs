import { ChatInputCommandInteraction, Collection, GuildMember, StringSelectMenuInteraction } from 'discord.js'
import {
  createMockFn,
  createMockGuild,
  createMockInteraction,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { RolesController, SELF_ROLES } from '@src/recipes/select-menus/roles.controller'

// #region spec
describe('RolesController', () => {
  const module = MeoCordTestingModule.create({ controllers: [RolesController] }).compile()
  const [announcements, events, gameNights] = SELF_ROLES.map(role => role.id)

  // A member in a server, holding the given roles
  function memberWith(...ids: string[]) {
    const roles = { cache: new Collection(ids.map(id => [id, { id }])), add: createMockFn(), remove: createMockFn() }
    const member = createMockInteraction(GuildMember, { roles: roles as never })
    return { member, roles, inServer: { guildId: '1', guild: createMockGuild(), member } }
  }

  it('shows each member their own menu, with the roles they have selected', async () => {
    const { inServer } = memberWith(events)
    const interaction = createMockInteraction(ChatInputCommandInteraction, inServer)

    await module.invoke(RolesController, 'show', interaction)

    const payload = JSON.parse(JSON.stringify(getResponse(interaction).calls[0].payload))
    const options = payload.components[0].components[0].options as { value: string; default: boolean }[]
    expect(options.filter(option => option.default).map(option => option.value)).toEqual([events])
    expect(interaction.ephemeral).toBe(true)
  })

  it('adds what was picked, removes what was left out, and ignores values it did not offer', async () => {
    const { roles, inServer } = memberWith(events)
    const interaction = createMockInteraction(StringSelectMenuInteraction, {
      customId: 'roles/pick',
      values: [announcements, gameNights, '999999999999999999'],
      ...inServer,
    })

    await module.invoke(RolesController, 'pick', interaction)

    expect(roles.add).toHaveBeenCalledWith([announcements, gameNights])
    expect(roles.remove).toHaveBeenCalledWith([events])
    expect(getResponse(interaction).calls[0].payload).toMatchObject({
      content: 'Your roles: Announcements, Game nights.',
    })
  })
})
// #endregion spec
