import { ButtonInteraction } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import {
  createMockInteraction,
  findRouteConflicts,
  getResponse,
  MeoCordTestingModule,
  resolveRoute,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { ProfileButtonController } from '@src/controllers/button/profile.button.controller'

@MeoCord({ controllers: [ProfileButtonController], clientOptions: { intents: [] } })
class App {}

describe('ProfileButtonController', () => {
  const module = MeoCordTestingModule.create({ controllers: [ProfileButtonController] }).compile()

  it('receives the values its pattern captures', async () => {
    const interaction = createMockInteraction(ButtonInteraction, { customId: 'profile/175928847299117063/800000001' })

    await module.invoke(ProfileButtonController, 'showProfile', interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({
      content: 'Profile 800000001, opened by <@175928847299117063>',
    })
  })

  it('routes an id both patterns match to the one literal first', () => {
    const route = (customId: string) => resolveRoute(App, { type: CommandType.BUTTON, customId })

    const summary = 'profile/175928847299117063/summary'
    expect(route(summary)).toMatchObject({ method: 'showSummary', params: { ownerId: '175928847299117063' } })
    // The pattern that also takes the id and lost to it
    expect(route(summary)?.alsoMatches).toEqual(['profile/{ownerId:snowflake}/{uid}'])
    expect(route('profile/175928847299117063/456')).toMatchObject({
      method: 'showProfile',
      params: { ownerId: '175928847299117063', uid: '456' },
    })
  })

  it('lists no pair, as the ranking tells every id apart', () => {
    expect(findRouteConflicts(App)).toEqual([])
  })
})
