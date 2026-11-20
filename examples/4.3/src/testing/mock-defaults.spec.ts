import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Collection,
  GuildMember,
  Locale,
  Message,
  SnowflakeUtil,
  TextChannel,
  User,
} from 'discord.js'
import { createMockChannel, createMockClient, createMockGuild, createMockInteraction } from 'meocord/testing'
import { describe, expect, it } from 'vitest'

describe('mock defaults', () => {
  it('gives an interaction the user’s locale, and the server’s only in a server', () => {
    const inDm = createMockInteraction(ChatInputCommandInteraction)
    const inServer = createMockInteraction(ButtonInteraction, { guildId: '1' })

    expect([inDm.locale, inDm.guildLocale]).toEqual([Locale.EnglishUS, null])
    expect(inServer.guildLocale).toBe(Locale.EnglishUS)
  })

  // #region promises
  it('resolves methods that return a promise in discord.js to something to work with', async () => {
    const client = createMockClient()
    const guild = createMockGuild()
    const channel = createMockChannel(TextChannel)

    // send() and reply() resolve to a message, so .catch() and awaited results just work
    await expect(client.users.send('1', 'hi').catch(() => undefined)).resolves.toBeInstanceOf(Message)
    // A manager's fetch by id resolves to that item, and a list fetch to an empty collection
    await expect(client.users.fetch('1')).resolves.toBeInstanceOf(User)
    await expect(guild.members.fetch('1')).resolves.toBeInstanceOf(GuildMember)
    await expect(guild.members.fetch()).resolves.toEqual(new Collection())
    // A structure's own edits and setters resolve to the structure
    await expect(channel.setName('general')).resolves.toBe(channel)
  })
  // #endregion promises

  // #region created
  it('reads an interaction’s creation time from its id, as discord.js does', () => {
    const before = Date.now()
    const made = createMockInteraction(ButtonInteraction, { customId: 'x' })
    const given = createMockInteraction(ButtonInteraction, { customId: 'x', id: '1200000000000000000' })

    // A generated id: the time the mock was made
    expect(made.createdTimestamp).toBeGreaterThanOrEqual(before)
    // An id you give: the time it encodes
    expect(given.createdAt).toEqual(new Date(SnowflakeUtil.timestampFrom('1200000000000000000')))
  })
  // #endregion created
})
