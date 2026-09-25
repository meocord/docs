import { MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { GreetingSlashController } from '@src/controllers/slash/greeting.slash.controller'
import { KeywordMessageController } from '@src/controllers/message/keyword.message.controller'
import { GreetingService } from '@src/services/greeting.service'
import { HelpService } from '@src/services/help.service'

// #region spec
describe('HelpService', () => {
  it('lists the commands, and not the message handlers', () => {
    const module = MeoCordTestingModule.create({
      controllers: [GreetingSlashController, KeywordMessageController],
      providers: [
        { provide: GreetingService, useClass: GreetingService },
        { provide: HelpService, useClass: HelpService },
      ],
    }).compile()

    expect(module.get(HelpService).lines()).toEqual(['/greet: Greets someone'])
  })
})
// #endregion spec
