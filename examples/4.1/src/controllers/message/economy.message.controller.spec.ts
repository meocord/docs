import { type GuildMember } from 'discord.js'
import { createMockGuild, createMockMessage, MeoCordTestingModule, resolveRoute } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import App from '@src/app-message-commands'
import { EconomyMessageController } from '@src/controllers/message/economy.message.controller'
import { ModerationMessageController } from '@src/controllers/message/moderation.message.controller'

const ANA = '123456789012345678'
const replyTo = (message: ReturnType<typeof createMockMessage>) => {
  const [reply] = message.reply.mock.calls[0] ?? []
  return typeof reply === 'string' ? reply : (reply as { content?: string } | undefined)?.content
}

// #region spec
describe('EconomyMessageController', () => {
  const module = MeoCordTestingModule.create({
    app: App,
    controllers: [EconomyMessageController, ModerationMessageController],
  }).compile()
  // A server whose member cache holds Ana, so their mention or ID resolves without a request
  const ana = { id: ANA, displayName: 'Ana', user: { id: ANA } } as unknown as GuildMember
  const inServer = (content: string) => createMockMessage({ content, guild: createMockGuild({ members: [ana] }) })

  it('turns each word into its type before the handler runs', async () => {
    const message = inServer(`!pay <@${ANA}> 25 for lunch`)
    await module.dispatch(message)
    expect(replyTo(message)).toBe('Paid Ana 25 for lunch')
  })

  it("answers a message that names the command but does not fit it with the command's usage", async () => {
    const message = inServer(`!pay <@${ANA}> lots`)
    await module.dispatch(message)
    expect(replyTo(message)).toBe('Usage: !pay <to> <amount> [note…]\namount: "lots" is not a valid whole number')
  })

  it('answers a member param sent in a DM that the command works in a server only', async () => {
    const message = createMockMessage({ content: `!pay ${ANA} 25`, guild: null })
    await module.dispatch(message)
    expect(replyTo(message)).toBe('This command works in a server only.')
  })
})
// #endregion spec

describe('ModerationMessageController and the built-in help', () => {
  const module = MeoCordTestingModule.create({
    app: App,
    controllers: [EconomyMessageController, ModerationMessageController],
  }).compile()

  it('routes an alias to its command, and refuses a flag the command does not have', async () => {
    expect(resolveRoute(App, { content: `!m <@${ANA}> 1h` })?.handler).toBe(ModerationMessageController.prototype.mute)
    const message = createMockMessage({ content: '!purge 5 --all' })
    await module.dispatch(message)
    expect(replyTo(message)).toBe(
      'Usage: !purge <count> [--bots] [--from=<from>]\n--all is not an option of this command',
    )
  })

  // #region help-spec
  it('answers !help with the commands, and !help m with the one it names', async () => {
    const list = createMockMessage({ content: '!help' })
    await module.dispatch(list)
    expect(replyTo(list)).toMatch(/^Commands:\n.*!mute <target> \[duration\] \[reason…\] — Times a member out/s)

    const one = createMockMessage({ content: '!help m' })
    await module.dispatch(one)
    expect(replyTo(one)).toContain(
      'Usage: !mute <target> [duration] [reason…]\nTimes a member out, for 10 minutes unless told otherwise.',
    )
  })
  // #endregion help-spec
})
