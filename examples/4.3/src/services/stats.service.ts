// #region service
import { Client } from 'discord.js'
import { ShardContext } from 'meocord/core'
import { Service } from 'meocord/decorator'

@Service()
export class StatsService {
  constructor(
    private readonly shards: ShardContext,
    private readonly client: Client,
  ) {}

  // The servers this process's shards are in
  guildCount() {
    return this.client.guilds.cache.size
  }

  // Every process's count, added up; a process that failed to answer counts as none
  async totalGuilds() {
    const results = await this.shards.call(StatsService, 'guildCount')
    return results.reduce((sum, result) => sum + (result.ok ? result.value : 0), 0)
  }
}
// #endregion service
