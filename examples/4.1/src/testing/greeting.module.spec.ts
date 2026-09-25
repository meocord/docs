import { ChatInputCommandInteraction, User } from 'discord.js'
import {
  createChatInputOptions,
  createMockInteraction,
  getResponse,
  inspectHandler,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import App from '@src/app-with-guards'
import { GreetingSlashController } from '@src/controllers/slash/greeting.slash.controller'
import { BlocklistGuard } from '@src/guards/blocklist.guard'
import { GreetingService } from '@src/services/greeting.service'

const greet = (userId: string) => {
  const interaction = createMockInteraction(ChatInputCommandInteraction, {
    user: createMockInteraction(User, { id: userId }),
  })
  interaction.options = createChatInputOptions({ name: 'Ada' })
  return interaction
}

describe('testing a controller', () => {
  // #region override
  it('swaps a dependency for a stand-in', async () => {
    const module = MeoCordTestingModule.create({ controllers: [GreetingSlashController] })
      .overrideProvider(GreetingService)
      .useValue({ buildGreeting: name => `Hi ${name}` })
      .compile()
    const interaction = greet('1')

    await module.invoke(GreetingSlashController, 'greet', interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'Hi Ada' })
  })
  // #endregion override

  // #region app
  it('runs the app’s global guards first, with app', async () => {
    const module = MeoCordTestingModule.create({ app: App, controllers: [GreetingSlashController] }).compile()

    await expect(module.invoke(GreetingSlashController, 'greet', greet('666666666666666666'))).resolves.toEqual({
      ran: false,
    })
    await expect(module.invoke(GreetingSlashController, 'greet', greet('1'))).resolves.toEqual({ ran: true })
    expect(inspectHandler(GreetingSlashController, 'greet', { app: App }).guards).toEqual([BlocklistGuard])
  })
  // #endregion app
})
