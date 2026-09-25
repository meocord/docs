// #region config
import './load-env'
import { type MeoCordConfig } from 'meocord/interface'

export default {
  discordToken: process.env.DISCORD_TOKEN!,
} satisfies MeoCordConfig
// #endregion config
