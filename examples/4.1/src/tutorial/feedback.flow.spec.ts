import {
  ButtonInteraction,
  Collection,
  GuildMember,
  Locale,
  ModalSubmitInteraction,
  TextChannel,
  User,
} from 'discord.js'
import {
  createMockChannel,
  createMockClient,
  createMockGuild,
  createMockInteraction,
  createMockMessage,
  createModalFields,
  getResponse,
  MeoCordTestingModule,
  type MockMessageOverrides,
  resolveRoute,
} from 'meocord/testing'
import { CommandType } from 'meocord/enum'
import { describe, expect, it } from 'vitest'
import App from '@src/tutorial/app'
import { FeedbackController } from '@src/tutorial/feedback.controller'
import { FeedbackSettings } from '@src/tutorial/feedback.settings'
import { ReviewController } from '@src/tutorial/review.controller'

// #region spec
describe('the feedback bot, from form to verdict', () => {
  const STAFF = '900'
  const module = MeoCordTestingModule.create({
    controllers: [FeedbackController, ReviewController],
    providers: [{ provide: FeedbackSettings, useValue: { reviewChannelId: '500', staffRoleId: STAFF } }],
    // The app's presenter styles what respond() shows, as on the running bot
    app: App,
  }).compile()

  // One client and one review channel, shared by every interaction, as on a running bot
  const channel = createMockChannel(TextChannel)
  channel.isSendable.mockReturnValue(true)
  const client = createMockClient()
  client.channels.fetch.mockResolvedValue(channel as never)
  client.users.send.mockResolvedValue(createMockMessage() as never)
  const inServer = { guildId: '1', guild: createMockGuild(), guildLocale: Locale.EnglishUS, client: client as never }

  it('carries feedback from the form to the staff, and the verdict back to its author', async () => {
    // Ada writes in Indonesian
    const submit = createMockInteraction(ModalSubmitInteraction, {
      ...inServer,
      customId: 'feedback/submit',
      locale: Locale.Indonesian,
      user: createMockInteraction(User, { id: '111', username: 'ada' }),
      fields: createModalFields({ about: 'Music bot', details: 'It skips songs.' }),
    })
    await module.invoke(FeedbackController, 'submit', submit)
    expect(getResponse(submit).calls[0].payload).toMatchObject({
      content: 'Terima kasih! Staf akan segera membacanya.',
    })

    // The review post, as the staff channel received it; its first button routes to approve
    const { embeds, components } = channel.send.mock.calls[0][0] as MockMessageOverrides
    const post = createMockMessage({ embeds, components })
    const customId = JSON.parse(JSON.stringify(components))[0].components[0].custom_id as string
    expect(resolveRoute(App, { type: CommandType.BUTTON, customId })).toMatchObject({
      handler: ReviewController.prototype.approve,
      params: { id: '1' },
    })

    // Grace, on the staff, approves it; she reads Discord in Indonesian too
    const staffMember = createMockInteraction(GuildMember, {
      roles: { cache: new Collection([[STAFF, { id: STAFF }]]) } as never,
    })
    const approve = createMockInteraction(ButtonInteraction, {
      ...inServer,
      customId,
      locale: Locale.Indonesian,
      member: staffMember,
      message: post,
      user: createMockInteraction(User, { id: '222', username: 'grace' }),
    })
    await module.invoke(ReviewController, 'approve', approve)

    // While it worked, the post showed the presenter's loading view in her language; then the
    // verdict, in the server's
    const [, loading, verdict] = getResponse(approve).calls
    expect(JSON.stringify(loading.payload)).toContain('Sedang diproses…')
    expect(JSON.parse(JSON.stringify(verdict.payload)).embeds[0]).toMatchObject({
      title: 'Feedback #1 from ada',
      footer: { text: 'Approved by grace.' },
    })
    expect(client.users.send).toHaveBeenCalledWith('111', { content: 'Masukanmu “Music bot” disetujui. Terima kasih!' })
  })
})
// #endregion spec
