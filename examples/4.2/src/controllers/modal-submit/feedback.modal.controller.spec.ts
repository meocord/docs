import { ModalSubmitInteraction } from 'discord.js'
import { createMockInteraction, createModalFields, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { FeedbackModalController } from '@src/controllers/modal-submit/feedback.modal.controller'

describe('FeedbackModalController', () => {
  const module = MeoCordTestingModule.create({ controllers: [FeedbackModalController] }).compile()

  it('receives the captured id and the submitted fields together', async () => {
    const interaction = createMockInteraction(ModalSubmitInteraction, {
      customId: 'feedback/42',
      fields: createModalFields({ body: 'It crashed' }),
    })

    await module.invoke(FeedbackModalController, 'submit', interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'Ticket 42: It crashed' })
  })
})
