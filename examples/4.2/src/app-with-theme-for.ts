import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { StoreSlashController } from '@src/controllers/slash/store.slash.controller'
import { ThemeSettingsSlashController } from '@src/controllers/slash/theme-settings.slash.controller'
import { guildThemes, userThemes } from '@src/themes/stored-themes'

// #region app
@MeoCord({
  controllers: [StoreSlashController, ThemeSettingsSlashController],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  theme: { colors: { primary: '#5865F2' } },
  themeFor: {
    // A server's theme goes over the handler's, and a user's over the server's; either may be async
    guild: ({ guild }) => guildThemes.get(guild.id),
    user: ({ user }) => userThemes.get(user.id),
  },
  themeCache: { ttlSeconds: 300, maxGuilds: 10_000, maxUsers: 50_000 },
  themeForTimeoutMs: 1_000,
})
export default class App {}
// #endregion app
