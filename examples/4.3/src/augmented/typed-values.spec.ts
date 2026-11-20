import { type GuildMember } from 'discord.js'
import { createMockGuild, createMockMember } from 'meocord/testing'
import { describe, expect, it } from 'vitest'

describe('typed values', () => {
  // #region typed
  it('take only what the mocked function gives', async () => {
    const guild = createMockGuild()
    const member = createMockMember({ guild })

    // One of fetch's overloads resolves to a member
    guild.members.fetch.mockResolvedValue(member)
    // @ts-expect-error: a partial fake is refused
    guild.members.fetch.mockResolvedValue({ id: member.id })
    // Cast it where it is intended
    guild.members.fetch.mockResolvedValue({ id: member.id } as GuildMember)

    expect(await guild.members.fetch(member.id)).toEqual({ id: member.id })
  })
  // #endregion typed
})
