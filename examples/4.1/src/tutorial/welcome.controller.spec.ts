import { ActivityType, type Client, type Guild, Locale } from 'discord.js'
import { createMockClient, createMockGuild, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it, vi } from 'vitest'
import { ActivityService } from '@src/tutorial/activity.service'
import { WelcomeController } from '@src/tutorial/welcome.controller'

describe('the feedback bot joining a server', () => {
  it("says how to leave feedback in the server's system channel", async () => {
    const module = MeoCordTestingModule.create({ controllers: [WelcomeController] }).compile()
    const send = vi.fn()
    const guild = Object.assign(createMockGuild(), { preferredLocale: Locale.EnglishUS })
    Object.defineProperty(guild, 'systemChannel', { value: { send } })

    await module.emit('guildCreate', guild as unknown as Guild)

    expect(send).toHaveBeenCalledWith(expect.stringContaining('/feedback'))
  })

  it('says it is listening for /feedback once it is online', () => {
    const client = createMockClient() as unknown as Client<true>

    new ActivityService().onReady(client)

    expect(client.user.setActivity).toHaveBeenCalledWith('/feedback', { type: ActivityType.Listening })
  })
})
