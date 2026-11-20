import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  type Message,
} from 'discord.js'
import { CommandNotFoundError } from 'meocord/common'
import { Command, Controller, MeoCord, MessageHandler } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import {
  createMockInteraction,
  createMockMessage,
  getResponse,
  MeoCordTestingModule,
  useStrictMocks,
} from 'meocord/testing'
import { describe, expect, it, vi } from 'vitest'

// Before any mock is made; a project's vitest.setup.ts makes this call for every spec
useStrictMocks()

@Controller()
class PollController {
  @Command('poll', CommandType.SLASH)
  async poll(interaction: ChatInputCommandInteraction) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('poll-pizza').setLabel('Pizza').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('poll-pasta').setLabel('Pasta').setStyle(ButtonStyle.Primary),
    )
    const response = await interaction.reply({ content: 'Pizza or pasta?', components: [row] })
    // One vote, answered by the collector rather than a route
    response
      .createMessageComponentCollector({ componentType: ComponentType.Button, max: 1 })
      .on('collect', click => void click.update({ content: `Counted: ${click.customId}`, components: [] }))
  }

  @MessageHandler('quiz')
  async quiz(message: Message) {
    if (!message.channel.isSendable()) return
    await message.reply('What is 2 + 2?')
    const answers = await message.channel.awaitMessages({
      filter: answer => answer.author.id === message.author.id,
      max: 1,
      time: 30_000,
    })
    await message.reply(answers.first()?.content === '4' ? 'Correct!' : 'Not quite.')
  }
}

@MeoCord({ controllers: [PollController], clientOptions: { intents: [] }, messages: { prefix: '!' } })
class PollApp {}

describe('collectors under strict mocks', () => {
  // #region component
  it('run on the reply, and hear a click built from it', async () => {
    const module = MeoCordTestingModule.fromApp(PollApp).compile()
    const command = createMockInteraction(ChatInputCommandInteraction, { commandName: 'poll' })
    await module.dispatch(command)

    // Built from the reply, the click is on the client the collector listens on
    const vote = createMockInteraction(ButtonInteraction, {
      customId: 'poll-pizza',
      message: await command.fetchReply(),
    })
    await module.dispatch(vote)

    expect(getResponse(vote)).toMatchObject({
      sent: true,
      calls: [{ method: 'update', payload: { content: 'Counted: poll-pizza' } }],
    })
  })
  // #endregion component

  // #region hand-over
  it('leave a click no route takes to the collector, and answer it when none listens', async () => {
    const module = MeoCordTestingModule.fromApp(PollApp).compile()
    const command = createMockInteraction(ChatInputCommandInteraction, { commandName: 'poll' })
    await module.dispatch(command)
    const message = await command.fetchReply()

    // The collector answers the first vote: no handler ran, and "not found" isn't sent
    const vote = createMockInteraction(ButtonInteraction, { customId: 'poll-pizza', message })
    expect(await module.dispatch(vote)).toEqual({ ran: false, handlers: [] })
    expect(getResponse(vote).calls.map(call => call.method)).toEqual(['update'])

    // It took one vote and stopped, so the next click has no listener
    const late = createMockInteraction(ButtonInteraction, { customId: 'poll-pasta', message })
    expect((await module.dispatch(late)).error).toBeInstanceOf(CommandNotFoundError)
  })
  // #endregion hand-over

  // #region await-messages
  it('collect the answer a handler waits for', async () => {
    const module = MeoCordTestingModule.fromApp(PollApp).compile()
    const ask = createMockMessage({ content: '!quiz' })

    // Started, not awaited: the handler waits for the answer
    const asked = module.dispatch(ask)
    await vi.waitFor(() => expect(ask.reply).toHaveBeenCalledWith('What is 2 + 2?'))

    await module.dispatch(createMockMessage({ content: '4', author: ask.author, channel: ask.channel }))
    await asked
    expect(ask.reply).toHaveBeenLastCalledWith('Correct!')
  })
  // #endregion await-messages
})
