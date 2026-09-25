// #region config
import 'dotenv/config'
import { type MeoCordConfig } from 'meocord/interface'

export default {
  discordToken: process.env.DISCORD_TOKEN!,
  // Everything the bot needs goes inside dist: no node_modules on the server
  bundleDependencies: true,
  // Packed if installed; the dependency that tries to load it carries on without it if not
  optionalExternals: ['supports-color'],
} satisfies MeoCordConfig
// #endregion config
