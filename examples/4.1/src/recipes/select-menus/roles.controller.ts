import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  MessageFlags,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
} from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { RolesCommandBuilder } from '@src/recipes/select-menus/roles.builder'

// #region controller
// The roles members may give themselves; the bot's role must sit above them
export const SELF_ROLES = [
  { id: '100000000000000001', label: 'Announcements' },
  { id: '100000000000000002', label: 'Events' },
  { id: '100000000000000003', label: 'Game nights' },
]

@Controller()
export class RolesController {
  // A private menu for each member, with the roles they already have selected
  @Command('roles', RolesCommandBuilder)
  async show(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return
    const has = (id: string) => interaction.member.roles.cache.has(id)
    const menu = new StringSelectMenuBuilder()
      .setCustomId('roles/pick')
      .setPlaceholder('Pick your roles')
      .setMinValues(0)
      .setMaxValues(SELF_ROLES.length)
      .addOptions(SELF_ROLES.map(role => ({ label: role.label, value: role.id, default: has(role.id) })))
    await respond(interaction).send({
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      flags: MessageFlags.Ephemeral,
    })
  }

  // The selection is the whole set: roles picked are added, self roles left out are removed
  @Command('roles/pick', CommandType.SELECT_MENU)
  async pick(interaction: StringSelectMenuInteraction) {
    if (!interaction.inCachedGuild()) return
    // Only the listed roles, whatever values the client sent
    const picked = new Set(interaction.values.filter(value => SELF_ROLES.some(role => role.id === value)))
    const roles = interaction.member.roles
    const add = SELF_ROLES.filter(role => picked.has(role.id) && !roles.cache.has(role.id)).map(role => role.id)
    const remove = SELF_ROLES.filter(role => !picked.has(role.id) && roles.cache.has(role.id)).map(role => role.id)
    if (add.length) await roles.add(add)
    if (remove.length) await roles.remove(remove)
    const names = SELF_ROLES.filter(role => picked.has(role.id)).map(role => role.label)
    await respond(interaction).send({
      content: names.length ? `Your roles: ${names.join(', ')}.` : 'No roles picked.',
      components: [],
    })
  }
}
// #endregion controller
