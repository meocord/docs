import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  PermissionsBitField,
  TextChannel,
  ThreadChannel,
  User,
} from 'discord.js'
import { CooldownError, GuardDeniedError } from 'meocord/common'
import {
  createMockFn,
  createMockInteraction,
  createModalFields,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { closeTicket, TicketController } from '@src/recipes/tickets/tickets'

// #region spec
describe('TicketController', () => {
  const compile = () => MeoCordTestingModule.create({ controllers: [TicketController] }).compile()
  const ada = createMockInteraction(User, { id: '111111111111111111', username: 'ada' })

  it('opens the form once every ten minutes for each member', async () => {
    const module = compile()
    const open = () => createMockInteraction(ChatInputCommandInteraction, { user: ada })

    await module.invoke(TicketController, 'open', open())

    await expect(module.invoke(TicketController, 'open', open())).rejects.toBeInstanceOf(CooldownError)
  })

  it('opens a private thread with the member in it, and tells them where', async () => {
    // The thread the channel creates, and a channel whose threads manager creates it
    const thread = createMockInteraction(ThreadChannel, { members: { add: createMockFn() } as never })
    const create = createMockFn().mockResolvedValue(thread)
    const channel = createMockInteraction(TextChannel, { threads: { create } as never })
    const interaction = createMockInteraction(ModalSubmitInteraction, {
      customId: 'ticket/create',
      user: ada,
      channel,
      fields: createModalFields({ subject: 'Lost role', details: 'My Member role is gone.' }),
    })

    await compile().invoke(TicketController, 'create', interaction)

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'ticket-ada', invitable: false }))
    expect(thread.members.add).toHaveBeenCalledWith('111111111111111111')
    expect(thread.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: '**Lost role**\nMy Member role is gone.' }),
    )
    expect(interaction.ephemeral).toBe(true)
  })

  it('lets staff who can manage threads close it, locking and archiving the thread', async () => {
    const thread = createMockInteraction(ThreadChannel)
    const interaction = createMockInteraction(ButtonInteraction, {
      customId: closeTicket.build({ ownerId: '111111111111111111' }),
      user: createMockInteraction(User, { id: '999' }),
      memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageThreads),
      // discord.js types a button's channel as a public or private thread, not the ThreadChannel class
      channel: thread as never,
    })

    await compile().invoke(TicketController, 'close', interaction)

    expect(getResponse(interaction).calls[0].method).toBe('update')
    expect(thread.setLocked).toHaveBeenCalledWith(true)
    expect(thread.setArchived).toHaveBeenCalledWith(true)
  })

  it('refuses anyone else, privately', async () => {
    const interaction = createMockInteraction(ButtonInteraction, {
      customId: closeTicket.build({ ownerId: '111111111111111111' }),
      user: createMockInteraction(User, { id: '222222222222222222' }),
      memberPermissions: new PermissionsBitField(),
    })

    await expect(compile().invoke(TicketController, 'close', interaction)).rejects.toThrow(GuardDeniedError)
  })
})
// #endregion spec
