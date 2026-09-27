import { type Guild } from 'discord.js'
import { Translator } from 'meocord/common'
import { Service } from 'meocord/decorator'
import type enUS from '@src/locales/en-US'

// #region service
// The translator `@MeoCord({ i18n: t })` provides, typed by the default catalog
@Service()
export class WarningsService {
  constructor(private readonly t: Translator<typeof enUS>) {}

  // A notice the whole server reads, so in the server's language
  notice(guild: Guild, user: string, count: number): string {
    return this.t.forGuild(guild)('warnings', { user, count })
  }
}
// #endregion service
