import { ButtonInteraction, ChatInputCommandInteraction, User } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import { createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { LeaderboardController } from '@src/recipes/pagination/leaderboard.controller'
import { LeaderboardService } from '@src/recipes/pagination/leaderboard.service'

type Page = { embeds: { description: string; footer: { text: string } }[]; components: Row[] }
type Row = { components: { custom_id: string; disabled?: boolean }[] }
// The payload as Discord receives it, builders turned into JSON
const sent = (interaction: ButtonInteraction | ChatInputCommandInteraction): Page =>
  JSON.parse(JSON.stringify(getResponse(interaction).calls[0].payload))
const user = (id: string) => createMockInteraction(User, { id })

// #region spec
describe('LeaderboardController', () => {
  const module = MeoCordTestingModule.create({
    controllers: [LeaderboardController],
    providers: [{ provide: LeaderboardService, useClass: LeaderboardService }],
  }).compile()

  it('replies with the first page, and a Next button that carries who opened it', async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction, { user: user('111') })

    await module.invoke(LeaderboardController, 'show', interaction)

    const page = sent(interaction)
    expect(getResponse(interaction).calls[0].method).toBe('reply')
    expect(page.embeds[0].footer.text).toBe('Page 1 of 3')
    expect(page.components[0].components).toEqual([
      expect.objectContaining({ custom_id: 'leaderboard/111/-1', disabled: true }),
      expect.objectContaining({ custom_id: 'leaderboard/111/1', disabled: false }),
    ])
  })

  it('turns to the page a button names, updating the message', async () => {
    const interaction = createMockInteraction(ButtonInteraction, { customId: 'leaderboard/111/2', user: user('111') })

    await module.invoke(LeaderboardController, 'turn', interaction)

    const page = sent(interaction)
    expect(getResponse(interaction).calls[0].method).toBe('update')
    expect(page.embeds[0].description).toBe('11. Kai: 450\n12. Lu: 375')
    expect(page.components[0].components[1].disabled).toBe(true)
  })

  it('refuses anyone else, privately', async () => {
    const interaction = createMockInteraction(ButtonInteraction, { customId: 'leaderboard/111/1', user: user('222') })

    await expect(module.invoke(LeaderboardController, 'turn', interaction)).rejects.toThrow(GuardDeniedError)
    expect(getResponse(interaction).sent).toBe(false)
  })
})
// #endregion spec
