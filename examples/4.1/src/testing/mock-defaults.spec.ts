import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Collection,
  GuildMember,
  Locale,
  Message,
  TextChannel,
  User,
} from 'discord.js'
import { createMockChannel, createMockClient, createMockGuild, createMockInteraction } from 'meocord/testing'
import { describe, expect, it } from 'vitest'

describe('mock defaults', () => {
  // #region locales
  it('gives an interaction the user’s locale, and the server’s only in a server', () => {
    const inDm = createMockInteraction(ChatInputCommandInteraction)
    const inServer = createMockInteraction(ButtonInteraction, { guildId: '1' })

    expect([inDm.locale, inDm.guildLocale]).toEqual([Locale.EnglishUS, null])
    expect(inServer.guildLocale).toBe(Locale.EnglishUS)
  })
  // #endregion locales

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
})
