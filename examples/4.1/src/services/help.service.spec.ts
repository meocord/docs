import { MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { GreetingSlashController } from '@src/controllers/slash/greeting.slash.controller'
import { ReportContextMenuController } from '@src/controllers/context-menu/report.context-menu.controller'
import { KeywordMessageController } from '@src/controllers/message/keyword.message.controller'
import { GreetingService } from '@src/services/greeting.service'
import { HelpService } from '@src/services/help.service'

// #region spec
describe('HelpService', () => {
  it('lists the slash commands, and not the context menu commands or message handlers', () => {
    const module = MeoCordTestingModule.create({
      controllers: [GreetingSlashController, ReportContextMenuController, KeywordMessageController],
      providers: [
        { provide: GreetingService, useClass: GreetingService },
        { provide: HelpService, useClass: HelpService },
      ],
    }).compile()

    expect(module.get(HelpService).lines()).toEqual(['/greet: Greets someone'])
  })
})
// #endregion spec
