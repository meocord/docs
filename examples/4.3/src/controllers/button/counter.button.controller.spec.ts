import { type ActionRowBuilder, ButtonInteraction, type ButtonBuilder } from 'discord.js'
import { createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { counter, CounterButtonController } from '@src/controllers/button/counter.button.controller'

describe('CounterButtonController', () => {
  const module = MeoCordTestingModule.create({ controllers: [CounterButtonController] }).compile()
  const press = (customId: string) => createMockInteraction(ButtonInteraction, { customId })

  it('gives the handler the count as a number, and builds the next button from it', async () => {
    const click = press('counter/41')

    await module.dispatch(click)

    const { components } = getResponse(click).calls[0].payload as { components: ActionRowBuilder<ButtonBuilder>[] }
    expect(components[0].toJSON().components[0]).toMatchObject({ custom_id: 'counter/42', label: '42' })
  })

  it('reaches no handler with a segment that is not a whole number', async () => {
    const { handlers } = await module.dispatch(press('counter/lots'))

    expect(handlers).toEqual([])
  })

  it('refuses to build a customId its handler could never read', () => {
    expect(() => counter.build({ count: 1.5 })).toThrow('which is not a value of its type')
  })
})
