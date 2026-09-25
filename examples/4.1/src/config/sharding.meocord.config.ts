// #region config
import 'dotenv/config'
import { type MeoCordConfig } from 'meocord/interface'

export default {
  discordToken: process.env.DISCORD_TOKEN!,
  // 'auto' asks Discord how many shards the bot needs; mode: 'process' runs each in a process of its own
  sharding: { shards: 'auto', mode: 'process' },
  // How long shutdown waits for the onShutdown hooks, in milliseconds
  shutdownTimeout: 15_000,
} satisfies MeoCordConfig
// #endregion config
