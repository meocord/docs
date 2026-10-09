import { ButtonInteraction, ChatInputCommandInteraction, GuildMember, RESTJSONErrorCodes, User } from 'discord.js'
import {
  createChatInputOptions,
  createDiscordError,
  createMockGuild,
  createMockInteraction,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { ModerationService, TimeoutController, timeoutAnswer } from '@src/recipes/moderation/timeout'

// #region spec
describe('TimeoutController', () => {
  let module: ReturnType<typeof compile>
  const compile = () => MeoCordTestingModule.create({ controllers: [TimeoutController] }).compile()
  beforeEach(() => (module = compile()))

  const moderator = createMockInteraction(User, { id: '111' })
  const target = createMockInteraction(User, { id: '999' })

  // A click in a server whose member fetch resolves the target, whose timeout() the test controls
  const click = (
    action: 'confirm' | 'cancel',
    id: number,
    member = createMockInteraction(GuildMember, { id: '999' }),
  ) => {
    const guild = createMockGuild()
    guild.members.fetch.mockResolvedValue(member as never)
    const customId = timeoutAnswer.build({ ownerId: '111', id, action })
    const interaction = createMockInteraction(ButtonInteraction, { customId, user: moderator, guildId: '1', guild })
    return { interaction, member }
  }

  async function propose() {
    const interaction = createMockInteraction(ChatInputCommandInteraction, {
      user: moderator,
      options: createChatInputOptions({ member: target, minutes: 10, reason: 'Spam' }),
    })
    await module.invoke(TimeoutController, 'propose', interaction)
    const payload = JSON.parse(JSON.stringify(getResponse(interaction).calls[0].payload))
    const customIds: string[] = payload.components[0].components.map(
      (button: { custom_id: string }) => button.custom_id,
    )
    // The proposal's id, the third segment of its buttons' customIds
    return { interaction, customIds, id: Number(customIds[0].split('/')[2]) }
  }

  it('asks the moderator to confirm, privately, with buttons naming the proposal', async () => {
    const { interaction, customIds, id } = await propose()

    expect(customIds).toEqual([`timeout/111/${id}/confirm`, `timeout/111/${id}/cancel`])
    expect(interaction.ephemeral).toBe(true)
  })

  it('times the member out on confirmation, once, and logs it', async () => {
    const { id } = await propose()
    const { interaction, member } = click('confirm', id)

    await module.invoke(TimeoutController, 'answer', interaction)

    expect(member.timeout).toHaveBeenCalledWith(600_000, 'Spam')
    expect(module.get(ModerationService).log).toMatchObject([{ targetId: '999', minutes: 10, reason: 'Spam' }])

    const again = click('confirm', id)
    await module.invoke(TimeoutController, 'answer', again.interaction)
    expect(again.member.timeout).not.toHaveBeenCalled()
  })

  it('does nothing to the member on Cancel', async () => {
    const { id } = await propose()
    const { interaction, member } = click('cancel', id)

    await module.invoke(TimeoutController, 'answer', interaction)

    expect(member.timeout).not.toHaveBeenCalled()
    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'Cancelled.' })
  })

  it('tells the moderator when Discord refuses for missing permissions', async () => {
    const { id } = await propose()
    const { interaction, member } = click('confirm', id)
    member.timeout.mockRejectedValue(createDiscordError(RESTJSONErrorCodes.MissingPermissions))

    const { error } = await module.invoke(TimeoutController, 'answer', interaction)

    expect(error).toMatchObject({ code: RESTJSONErrorCodes.MissingPermissions })
    expect(getResponse(interaction).sent).toBe(true)
    expect(module.get(ModerationService).log).toEqual([])
  })
})
// #endregion spec
