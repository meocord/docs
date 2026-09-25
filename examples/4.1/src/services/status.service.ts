// #region service
import { ActivityType, Client } from 'discord.js'
import { Service } from 'meocord/decorator'
import { type OnReady } from 'meocord/interface'
import { GreetingService } from '@src/services/greeting.service'

// Nothing injects it, so the app lists it in `services`
@Service()
export class StatusService implements OnReady {
  constructor(
    private readonly client: Client,
    private readonly greetings: GreetingService,
  ) {}

  onReady() {
    this.client.user?.setActivity(this.greetings.buildGreeting('everyone'), { type: ActivityType.Custom })
  }
}
// #endregion service
