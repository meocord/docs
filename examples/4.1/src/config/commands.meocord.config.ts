import 'dotenv/config'
import { type MeoCordConfig } from 'meocord/interface'

// #region config
export default {
  discordToken: process.env.DISCORD_TOKEN!,
  commands: {
    // Under `meocord start --dev`, every command goes to this guild and nowhere else
    developmentGuild: process.env.DEV_GUILD_ID || undefined,
    // Guild ids to register every command to instead of globally
    guilds: undefined,
    // false: only `meocord register` registers
    register: true,
    // true: remove this application's commands from the named scopes it does not use
    clearOther: false,
  },
} satisfies MeoCordConfig
// #endregion config
