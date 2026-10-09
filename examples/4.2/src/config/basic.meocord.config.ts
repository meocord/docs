// #region config
import 'dotenv/config'
import { type MeoCordConfig } from 'meocord/interface'

export default {
  appName: 'MyBot',
  // Read from the environment: this file is committed, and .env is not
  discordToken: process.env.DISCORD_TOKEN!,
  rsbuild: config => {
    // Import .md and .html files as their text
    config.tools ??= {}
    config.tools.rspack = (_rspackConfig, { addRules }) => {
      addRules([{ test: /\.(md|html)$/i, type: 'asset/source' }])
    }
    return config
  },
} satisfies MeoCordConfig
// #endregion config
