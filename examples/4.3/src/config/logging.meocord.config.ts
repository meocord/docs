// #region config
import 'dotenv/config'
import { type MeoCordConfig } from 'meocord/interface'

export default {
  // Every log line starts with it, so a bot's lines stand out among other processes'
  appName: 'Feedback',
  discordToken: process.env.DISCORD_TOKEN!,
  // Warnings and errors only; MEOCORD_LOG_LEVEL=debug prints everything for one run, without a rebuild
  logLevel: 'warn',
} satisfies MeoCordConfig
// #endregion config
