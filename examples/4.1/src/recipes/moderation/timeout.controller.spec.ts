import { ButtonInteraction, ChatInputCommandInteraction, GuildMember, User } from 'discord.js'
import {
  createChatInputOptions,
  createDiscordError,
  createMockGuild,
  createMockInteraction,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { ModerationService } from '@src/recipes/moderation/moderation.service'
import { TimeoutController } from '@src/recipes/moderation/timeout.controller'

// #region spec
describe('TimeoutController', () => {
  let module: ReturnType<typeof compile>
  const compile = () =>
    MeoCordTestingModule.create({
      controllers: [TimeoutController],
      providers: [{ provide: ModerationService, useClass: ModerationService }],
    }).compile()
  beforeEach(() => (module = compile()))

  const moderator = createMockInteraction(User, { id: '111' })
  const target = createMockInteraction(User, { id: '999' })

  // The member the button's guild resolves, whose timeout() the test controls
  const clickIn = (customId: string, member = createMockInteraction(GuildMember, { id: '999' })) => {
    const guild = createMockGuild()
    guild.members.fetch.mockResolvedValue(member as never)
    const interaction = createMockInteraction(ButtonInteraction, { customId, user: moderator, guildId: '1', guild })
    return { interaction, member }
  }

  async function propose() {
    const interaction = createMockInteraction(ChatInputCommandInteraction, {
      user: moderator,
      options: createChatInputOptions({ member: target, minutes: 10, reason: 'Spam' }),
    })
    await module.invoke(TimeoutController, 'propose', interaction)
    return interaction
  }

  it('asks the moderator to confirm, privately, with buttons naming the proposal', async () => {
    const interaction = await propose()

    const payload = JSON.parse(JSON.stringify(getResponse(interaction).calls[0].payload))
    expect(payload.components[0].components.map((button: { custom_id: string }) => button.custom_id)).toEqual([
      'timeout/111/1/confirm',
      'timeout/111/1/cancel',
    ])
    expect(interaction.ephemeral).toBe(true)
  })

  it('times the member out on confirmation, once, and logs it', async () => {
    await propose()
    const { interaction, member } = clickIn('timeout/111/1/confirm')

    await module.invoke(TimeoutController, 'confirm', interaction)

    expect(member.timeout).toHaveBeenCalledWith(600_000, 'Spam')
    expect(module.get(ModerationService).log).toMatchObject([{ targetId: '999', minutes: 10, reason: 'Spam' }])

    const again = clickIn('timeout/111/1/confirm')
    await module.invoke(TimeoutController, 'confirm', again.interaction)
    expect(again.member.timeout).not.toHaveBeenCalled()
  })

  it('tells the moderator when Discord refuses for missing permissions', async () => {
    await propose()
    const { interaction, member } = clickIn('timeout/111/1/confirm')
    member.timeout.mockRejectedValue(createDiscordError(50013))

    const { error } = await module.invoke(TimeoutController, 'confirm', interaction)

    expect(error).toMatchObject({ code: 50013 })
    expect(getResponse(interaction).sent).toBe(true)
    expect(module.get(ModerationService).log).toEqual([])
  })
})
// #endregion spec
