// #region helpers
import { ButtonInteraction } from 'discord.js'
import {
  createMockInteraction,
  createMockUser,
  MeoCordTestingModule,
  type Provider,
  type TestingModule,
} from 'meocord/testing'
import { CardButtonController } from '@src/controllers/button/card.button.controller'

/** A compiled module of the card buttons, with the providers a spec puts in place. */
export function makeModule(providers: Provider[] = []): TestingModule {
  return MeoCordTestingModule.create({ controllers: [CardButtonController], providers }).compile()
}

/** Clicks the button `customId` as the user `userId`: the click, and what `dispatch` made of it. */
export async function pressButton(module: TestingModule, customId: string, userId: string) {
  const click = createMockInteraction(ButtonInteraction, { customId, user: createMockUser({ id: userId }) })
  return { click, ...(await module.dispatch(click)) }
}
// #endregion helpers
