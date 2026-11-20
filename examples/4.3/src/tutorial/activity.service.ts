import { ActivityType, type Client } from 'discord.js'
import { Service } from 'meocord/decorator'
import { type OnReady } from 'meocord/interface'

// #region lifecycle-hooks
// Once the bot is online, its profile says how to reach it
@Service()
export class ActivityService implements OnReady {
  onReady(client: Client<true>) {
    client.user.setActivity('/feedback', { type: ActivityType.Listening })
  }
}
// #endregion lifecycle-hooks
