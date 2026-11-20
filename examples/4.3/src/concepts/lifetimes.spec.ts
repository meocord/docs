import { ButtonInteraction } from 'discord.js'
import { createMockInteraction, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { CountingGuard, VisitButtonController, VisitCounter } from '@src/concepts/lifetimes'

// #region spec
describe('lifetimes', () => {
  it('shares one controller and service across calls, and makes a guard for each call', async () => {
    const module = MeoCordTestingModule.create({
      controllers: [VisitButtonController],
      providers: [{ provide: VisitCounter, useClass: VisitCounter }],
    }).compile()
    const click = () => createMockInteraction(ButtonInteraction, { customId: 'visit' })

    await module.invoke(VisitButtonController, 'visit', click())
    await module.invoke(VisitButtonController, 'visit', click())

    expect(module.get(VisitButtonController)).toBe(module.get(VisitButtonController))
    expect(module.get(VisitCounter).count).toBe(2)
    expect(CountingGuard.created).toBe(2)
  })
})
// #endregion spec
