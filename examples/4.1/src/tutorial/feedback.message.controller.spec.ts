import { Collection, GuildMember, Locale, MessageReaction, User } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { ReactionHandlerAction } from 'meocord/enum'
import {
  createMockClient,
  createMockGuild,
  createMockInteraction,
  createMockMessage,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { FeedbackMessageController } from '@src/tutorial/feedback.message.controller'
import { FeedbackService } from '@src/tutorial/feedback.service'
import { FeedbackSettings } from '@src/tutorial/feedback.settings'
import { ReviewReactionController } from '@src/tutorial/review.reaction.controller'

const STAFF = '900'

// The bot answers a mention of itself, so it needs no MessageContent intent
@MeoCord({
  controllers: [FeedbackMessageController, ReviewReactionController],
  clientOptions: { intents: [] },
  messages: { mention: 'only' },
})
class TutorialMessages {}

// A server whose language is `locale`; the mock leaves it unset otherwise
const guildIn = (locale: Locale) => Object.assign(createMockGuild(), { preferredLocale: locale })

const reply = (message: ReturnType<typeof createMockMessage>, call = 0) => {
  const [sent] = message.reply.mock.calls[call] ?? []
  return typeof sent === 'string' ? sent : (sent as { content?: string } | undefined)?.content
}

describe('the feedback bot in chat', () => {
  const module = MeoCordTestingModule.create({
    app: TutorialMessages,
    controllers: [FeedbackMessageController, ReviewReactionController],
    providers: [{ provide: FeedbackSettings, useValue: { reviewChannelId: '500', staffRoleId: STAFF } }],
  }).compile()
  const guild = guildIn(Locale.EnglishUS)
  const said = async (text: string, where = guild) => {
    const message = createMockMessage({ guild: where })
    message.content = `<@${message.client.user.id}> ${text}`
    await module.dispatch(message)
    return message
  }

  it('files feedback from a mention, and answers a misuse with the usage', async () => {
    expect(reply(await said('feedback idea Add a dark mode'))).toMatch(/^Filed as feedback #\d+\. Thank you!$/)
    expect(reply(await said('feedback wish Add a dark mode'))).toContain('Usage: ')
  })

  it('says where feedback stands, with its details on --details, and when there is none', async () => {
    const { id } = module
      .get(FeedbackService)
      .add({ authorId: '1', locale: Locale.EnglishUS, about: 'bug', details: 'Crash' })
    expect(reply(await said(`status ${id}`))).toBe(`Feedback #${id} is open.`)
    expect(reply(await said(`status ${id} --details`))).toBe(`Feedback #${id} is open.\n> Crash`)
    expect(reply(await said('status 999'))).toBe('There is no feedback #999.')
    expect(reply(await said('status lots'))).toContain('"lots" is not a valid whole number')
  })
  // #region step:localisation

  it("answers in the server's language", async () => {
    const { id } = module
      .get(FeedbackService)
      .add({ authorId: '1', locale: Locale.Indonesian, about: 'bug', details: 'Crash' })
    expect(reply(await said(`status ${id}`, guildIn(Locale.Indonesian)))).toBe(`Masukan #${id} masih terbuka.`)
  })
  // #endregion step:localisation

  // A reaction to a reply of the bot's, from a member holding the given roles; its filing reply unless given
  async function react(emoji: string, roles: string[], content?: string) {
    const { id } = module
      .get(FeedbackService)
      .add({ authorId: '1', locale: Locale.EnglishUS, about: 'idea', details: 'Themes' })
    const reviewed = guildIn(Locale.EnglishUS)
    const member = createMockInteraction(GuildMember, {
      roles: { cache: new Collection(roles.map(role => [role, { id: role }])) } as never,
    })
    reviewed.members.fetch.mockResolvedValue(member as never)
    // The bot's own filing reply: sent by the client's user
    const client = createMockClient()
    const filed = createMockMessage({
      guild: reviewed,
      client,
      author: client.user!,
      content: content ?? `Filed as feedback #${id}. Thank you!`,
    })
    const reaction = createMockInteraction(MessageReaction, { message: filed, emoji: { name: emoji } as never })
    const user = createMockInteraction(User, { id: '222', username: 'grace', bot: false })

    await module.dispatch(reaction, { user, action: ReactionHandlerAction.ADD })
    return { id, filed }
  }

  it("decides feedback from a staff member's reaction to the bot's filing reply", async () => {
    const approved = await react('✅', [STAFF])
    expect(module.get(FeedbackService).get(approved.id).status).toBe('approved')
    expect(reply(approved.filed)).toBe(`Feedback #${approved.id} is approved.`)

    const rejected = await react('❌', [STAFF])
    expect(module.get(FeedbackService).get(rejected.id).status).toBe('rejected')
  })

  it('ignores a reaction to a reply that names feedback the bot does not hold', async () => {
    const { filed } = await react('✅', [STAFF], 'There is no feedback #999.')
    expect(filed.reply).not.toHaveBeenCalled()
  })

  it('leaves feedback open when someone without the staff role reacts', async () => {
    const { id, filed } = await react('✅', [])
    expect(module.get(FeedbackService).get(id).status).toBe('open')
    expect(filed.reply).not.toHaveBeenCalled()
  })
})
