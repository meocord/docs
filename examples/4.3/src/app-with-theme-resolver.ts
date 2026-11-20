import { GatewayIntentBits } from 'discord.js'
import { ThemeCache } from 'meocord/common'
import { MeoCord, Service } from 'meocord/decorator'
import { type ThemeOverride, type ThemeResolver, type UserThemeTarget } from 'meocord/interface'
import { StoreSlashController } from '@src/controllers/slash/store.slash.controller'

// #region resolver
@Service()
export class PrefsService {
  // A database in a real bot, which a provider connects
  private readonly choices = new Map<string, ThemeOverride>()

  constructor(private readonly themes: ThemeCache) {}

  async themeOf(userId: string): Promise<ThemeOverride | undefined> {
    return this.choices.get(userId)
  }

  async choose(userId: string, theme: ThemeOverride) {
    this.choices.set(userId, theme)
    // The user's next call looks their theme up again
    this.themes.invalidateUser(userId)
  }
}

@Service()
export class UserThemes implements ThemeResolver {
  constructor(private readonly prefs: PrefsService) {}

  user({ user }: UserThemeTarget) {
    return this.prefs.themeOf(user.id)
  }
}

@MeoCord({
  controllers: [StoreSlashController],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  themeFor: UserThemes,
})
export default class App {}
// #endregion resolver
