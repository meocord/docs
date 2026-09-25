import { ChatInputCommandInteraction, Locale, ModalSubmitInteraction, TextChannel, User } from 'discord.js'
import { CooldownError } from 'meocord/common'
import {
  createMockChannel,
  createMockClient,
  createMockInteraction,
  createModalFields,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { FeedbackController } from '@src/tutorial/feedback.controller'
import { FeedbackSettings } from '@src/tutorial/feedback.settings'

// #region spec
describe('FeedbackController', () => {
  const settings = { reviewChannelId: '500', staffRoleId: '900' }
  const compile = () =>
    MeoCordTestingModule.create({
      controllers: [FeedbackController],
      // The real settings read the environment; the test says where the review channel is
      providers: [{ provide: FeedbackSettings, useValue: settings }],
    }).compile()
  const ada = createMockInteraction(User, { id: '111', username: 'ada' })

  it('opens the form in the member’s language, once every five minutes', async () => {
    const module = compile()
    const open = () => createMockInteraction(ChatInputCommandInteraction, { user: ada, locale: Locale.Indonesian })
    const interaction = open()

    await module.invoke(FeedbackController, 'open', interaction)

    const [call] = getResponse(interaction).calls
    expect(call.method).toBe('showModal')
    expect(JSON.parse(JSON.stringify(call.payload))).toMatchObject({
      custom_id: 'feedback/submit',
      title: 'Kirim masukan',
    })
    await expect(module.invoke(FeedbackController, 'open', open())).rejects.toBeInstanceOf(CooldownError)
  })

  it('posts the feedback for review with its buttons, and thanks the author privately', async () => {
    const channel = createMockChannel(TextChannel)
    channel.isSendable.mockReturnValue(true)
    const client = createMockClient()
    client.channels.fetch.mockResolvedValue(channel as never)
    const interaction = createMockInteraction(ModalSubmitInteraction, {
      customId: 'feedback/submit',
      user: ada,
      client: client as never,
      fields: createModalFields({ about: 'Music bot', details: 'It skips songs.' }),
    })

    await compile().invoke(FeedbackController, 'submit', interaction)

    expect(client.channels.fetch).toHaveBeenCalledWith('500')
    const post = JSON.parse(JSON.stringify(channel.send.mock.calls[0][0]))
    expect(post.embeds[0]).toMatchObject({
      title: 'Feedback #1 from ada',
      description: '**Music bot**\nIt skips songs.',
    })
    expect(post.components[0].components.map((button: { custom_id: string }) => button.custom_id)).toEqual([
      'feedback/1/approve',
      'feedback/1/reject',
    ])
    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'Thanks! The staff will read it soon.' })
    expect(interaction.ephemeral).toBe(true)
  })
})
// #endregion spec
