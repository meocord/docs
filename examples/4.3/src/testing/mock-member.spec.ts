import { ChatInputCommandInteraction, PermissionFlagsBits, PermissionsBitField, Role, TextChannel } from 'discord.js'
import {
  createMockGuild,
  createMockInteraction,
  createMockMember,
  createMockUser,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { ModerationSlashController } from '@src/controllers/slash/moderation.slash.controller'
import { ROLE_IDS } from '@src/guards/role-ids'

describe('mock members', () => {
  const module = MeoCordTestingModule.create({ controllers: [ModerationSlashController] }).compile()

  // #region member
  it('lets in a member with a required role, and no one without it', async () => {
    const moderator = createMockInteraction(Role, { id: ROLE_IDS.moderator, name: 'moderator' })
    const ana = createMockUser()
    const guild = createMockGuild({ members: [createMockMember({ user: ana, roles: [moderator] })] })

    const fromAna = createMockInteraction(ChatInputCommandInteraction, { user: ana, guildId: guild.id, guild })
    const fromStranger = createMockInteraction(ChatInputCommandInteraction, { guildId: guild.id, guild })

    await expect(module.invoke(ModerationSlashController, 'ban', fromAna)).resolves.toEqual({ ran: true })
    await expect(module.invoke(ModerationSlashController, 'ban', fromStranger)).resolves.toEqual({ ran: false })
  })
  // #endregion member

  // #region permissions
  it("takes a member's permissions from its roles, @everyone's included", () => {
    const kick = createMockInteraction(Role, {
      permissions: new PermissionsBitField([PermissionFlagsBits.KickMembers]),
    })
    const member = createMockMember({ roles: [kick] })

    expect(member.permissions.has(PermissionFlagsBits.KickMembers)).toBe(true)
    expect(member.permissions.has(PermissionFlagsBits.BanMembers)).toBe(false)
    expect([...member.roles.cache.values()]).toEqual([member.guild.roles.everyone, kick])
  })
  // #endregion permissions

  // #region channel
  it('answers in the channel the interaction came from, and finds a member by id', async () => {
    const ana = createMockMember()
    const guild = createMockGuild({ members: [ana] })
    const interaction = createMockInteraction(ChatInputCommandInteraction, { guildId: guild.id, guild })

    const channel = interaction.channel as TextChannel
    await channel.send('Posted here.')

    expect(channel.send).toHaveBeenCalledWith('Posted here.')
    expect(guild.channels.cache.get(interaction.channelId)).toBe(channel)
    await expect(guild.members.fetch(ana.id)).resolves.toBe(ana)
  })
  // #endregion channel
})
