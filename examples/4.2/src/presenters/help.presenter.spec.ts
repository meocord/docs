import { type EmbedBuilder, type Message } from 'discord.js'
import { Controller, MeoCord, MessageHandler } from 'meocord/decorator'
import { createMockMessage, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { ModerationMessageController } from '@src/controllers/message/moderation.message.controller'
import { HelpPresenter } from '@src/presenters/help.presenter'

// A parent, `config`, with no handler of its own
@Controller()
class ConfigMessageController {
  @MessageHandler('config get {key}', { description: 'Reads a setting.' })
  async get(_message: Message, _params: { key: string }) {}

  @MessageHandler('config reset', { description: 'Puts every setting back.' })
  async reset(_message: Message) {}
}

@MeoCord({
  controllers: [ModerationMessageController, ConfigMessageController],
  clientOptions: { intents: [] },
  messages: { prefix: '!', help: true },
  presenter: HelpPresenter,
})
class HelpApp {}

describe('HelpPresenter', () => {
  const module = MeoCordTestingModule.create({
    app: HelpApp,
    controllers: [ModerationMessageController, ConfigMessageController],
  }).compile()

  const ask = async (content: string) => {
    const message = createMockMessage({ content })
    await module.dispatch(message)
    return message.reply.mock.calls[0][0] as { content?: string; embeds?: EmbedBuilder[] }
  }
  const embeds = async (content: string) => (await ask(content)).embeds ?? []

  it('writes the list as an embed', async () => {
    const [list] = await embeds('!help')

    expect(list.data.title).toBe('Commands')
    expect(list.data.description).toContain('`!mute <target> [duration] [reason…]`')
    expect(list.data.footer?.text).toBe('!help <command> shows one')
  })

  it('writes one command with its params', async () => {
    const [mute] = await embeds('!help mute')

    expect(mute.data.title).toBe('!mute <target> [duration] [reason…]')
    expect(mute.data.description).toBe('Times a member out, for 10 minutes unless told otherwise.')
    expect(mute.data.fields?.map(field => field.name)).toEqual(['target', 'duration (optional)', 'reason (optional)'])
  })

  it("writes a parent's subcommands", async () => {
    const [config] = await embeds('!help config')

    expect(config.data.title).toBe('Subcommands')
    expect(config.data.description).toBe(
      '`!config get <key>`\nReads a setting.\n\n`!config reset`\nPuts every setting back.',
    )
  })

  it('says when no command has the name', async () => {
    // A string is sent as the reply's text, without pinging anyone
    expect(await ask('!help nothing')).toMatchObject({ content: 'No command is called nothing. !help lists them.' })
  })
})
