import { MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction } from 'discord.js'
import {
  createMockInteraction,
  createMockMessage,
  createMockUser,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { ReportContextMenuController } from '@src/controllers/context-menu/report.context-menu.controller'

// #region spec
describe('ReportContextMenuController', () => {
  const module = MeoCordTestingModule.create({ controllers: [ReportContextMenuController] }).compile()

  it('reports the member the menu was opened on', async () => {
    const target = createMockUser()
    Object.assign(target, { username: 'mika' })
    const interaction = createMockInteraction(UserContextMenuCommandInteraction, {
      commandName: 'Report user',
      targetUser: target,
    })

    await module.invoke(ReportContextMenuController, 'report', interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({
      content: 'Thanks, mika was reported to the staff.',
    })
  })

  it('DMs a link to the message the menu was opened on', async () => {
    const targetMessage = createMockMessage({ id: '1300000000000000000' })
    Object.assign(targetMessage, { url: 'https://discord.com/channels/1/2/1300000000000000000' })
    const interaction = createMockInteraction(MessageContextMenuCommandInteraction, {
      commandName: 'Bookmark',
      targetMessage,
    })

    await module.invoke(ReportContextMenuController, 'bookmark', interaction)

    expect(interaction.user.send).toHaveBeenCalledWith({ content: `Bookmarked: ${targetMessage.url}` })
  })
})
// #endregion spec
