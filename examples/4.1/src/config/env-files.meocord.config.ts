// #region config
import { config } from 'dotenv'
import { type MeoCordConfig } from 'meocord/interface'

// The .env files Bun reads, most specific first: dotenv keeps the first value a variable is given, and one set in the
// shell over all of them. A production build reads the production files, however the bot is started.
const mode = process.env.NODE_ENV || 'development'
config({
  path: [`.env.${mode}.local`, ...(mode === 'test' ? [] : ['.env.local']), `.env.${mode}`, '.env'],
  quiet: true,
})

export default {
  discordToken: process.env.DISCORD_TOKEN!,
} satisfies MeoCordConfig
// #endregion config
