import { Client } from 'discord.js'
import { createMockClient, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { GreetingService } from '@src/services/greeting.service'
import { StatusService } from '@src/services/status.service'

describe('StatusService', () => {
  it('gets its dependencies injected, the Discord client among them', () => {
    const client = createMockClient()
    const module = MeoCordTestingModule.create({
      providers: [
        { provide: StatusService, useClass: StatusService },
        { provide: GreetingService, useClass: GreetingService },
        { provide: Client, useValue: client },
      ],
    }).compile()

    module.get(StatusService).onReady()

    expect(client.user?.setActivity).toHaveBeenCalledWith('Hello, everyone!', expect.anything())
  })
})
