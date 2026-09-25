import {
  ButtonInteraction,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  PermissionsBitField,
  TextChannel,
  ThreadChannel,
  User,
} from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import {
  createMockFn,
  createMockInteraction,
  createModalFields,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { TicketController } from '@src/recipes/tickets/ticket.controller'

// #region spec
describe('TicketController', () => {
  const module = MeoCordTestingModule.create({ controllers: [TicketController] }).compile()
  const ada = createMockInteraction(User, { id: '111', username: 'ada' })

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

    await module.invoke(TicketController, 'create', interaction)

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'ticket-ada', invitable: false }))
    expect(thread.members.add).toHaveBeenCalledWith('111')
    expect(thread.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: '**Lost role**\nMy Member role is gone.' }),
    )
    expect(interaction.ephemeral).toBe(true)
  })

  it('lets staff who can manage threads close it, locking and archiving the thread', async () => {
    const thread = createMockInteraction(ThreadChannel)
    const interaction = createMockInteraction(ButtonInteraction, {
      customId: 'ticket/111/close',
      user: createMockInteraction(User, { id: '999' }),
      memberPermissions: new PermissionsBitField(PermissionFlagsBits.ManageThreads),
      // discord.js types a button's channel as a public or private thread, not the ThreadChannel class
      channel: thread as never,
    })

    await module.invoke(TicketController, 'close', interaction)

    expect(getResponse(interaction).calls[0].method).toBe('update')
    expect(thread.setLocked).toHaveBeenCalledWith(true)
    expect(thread.setArchived).toHaveBeenCalledWith(true)
  })

  it('refuses anyone else, privately', async () => {
    const interaction = createMockInteraction(ButtonInteraction, {
      customId: 'ticket/111/close',
      user: createMockInteraction(User, { id: '222' }),
      memberPermissions: new PermissionsBitField(),
    })

    await expect(module.invoke(TicketController, 'close', interaction)).rejects.toThrow(GuardDeniedError)
  })
})
// #endregion spec
