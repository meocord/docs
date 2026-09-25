import { ButtonInteraction, Collection, EmbedBuilder, GuildMember, Locale, User } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import {
  createMockClient,
  createMockGuild,
  createMockInteraction,
  createMockMessage,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { FeedbackService } from '@src/tutorial/feedback.service'
import { FeedbackSettings } from '@src/tutorial/feedback.settings'
import { ReviewController } from '@src/tutorial/review.controller'

// #region spec
describe('ReviewController', () => {
  const STAFF = '900'

  // A fresh module holding one open feedback, from an author who writes in Indonesian
  function setup() {
    const module = MeoCordTestingModule.create({
      controllers: [ReviewController],
      providers: [{ provide: FeedbackSettings, useValue: { reviewChannelId: '500', staffRoleId: STAFF } }],
    }).compile()
    const feedback = module
      .get(FeedbackService)
      .add({ authorId: '111', locale: Locale.Indonesian, about: 'Music bot', details: 'It skips songs.' })
    return { module, feedback }
  }

  // A click on the review post, by a member holding the given roles
  function click(customId: string, ...roles: string[]) {
    const member = createMockInteraction(GuildMember, {
      roles: { cache: new Collection(roles.map(id => [id, { id }])) } as never,
    })
    const client = createMockClient()
    client.users.send.mockResolvedValue(createMockMessage() as never)
    return createMockInteraction(ButtonInteraction, {
      customId,
      guildId: '1',
      guild: createMockGuild(),
      member,
      user: createMockInteraction(User, { id: '222', username: 'grace' }),
      client: client as never,
      locale: Locale.EnglishUS,
      guildLocale: Locale.EnglishUS,
      message: createMockMessage({ embeds: [new EmbedBuilder().setTitle('Feedback #1 from ada')] }),
    })
  }

  it('lets staff approve: the post shows the verdict, and the author hears in their language', async () => {
    const { module } = setup()
    const interaction = click('feedback/1/approve', STAFF)

    await module.invoke(ReviewController, 'approve', interaction)

    // The first edit is @Defer's loading view; the last is the verdict
    const payload = JSON.parse(JSON.stringify(getResponse(interaction).calls.at(-1)?.payload))
    expect(payload.embeds[0]).toMatchObject({ title: 'Feedback #1 from ada', footer: { text: 'Approved by grace.' } })
    expect(payload.components).toEqual([])
    expect(interaction.client.users.send).toHaveBeenCalledWith('111', {
      content: 'Masukanmu “Music bot” disetujui. Terima kasih!',
    })
    expect(module.get(FeedbackService).get('1').status).toBe('approved')
  })

  it('refuses a member without the staff role, and changes nothing', async () => {
    const { module, feedback } = setup()

    await expect(module.invoke(ReviewController, 'reject', click('feedback/1/reject'))).rejects.toThrow(
      GuardDeniedError,
    )
    expect(feedback.status).toBe('open')
  })

  it('answers a button whose feedback is gone privately, in the member’s words', async () => {
    const { module } = setup()
    const interaction = click('feedback/7/approve', STAFF)

    await module.invoke(ReviewController, 'approve', interaction)

    expect(JSON.stringify(getResponse(interaction).calls.at(-1)?.payload)).toContain('That feedback no longer exists.')
    expect(interaction.client.users.send).not.toHaveBeenCalled()
  })
})
// #endregion spec
