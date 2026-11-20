import { type Guild } from 'discord.js'
import { Controller, On } from 'meocord/decorator'
// #region step:localisation
import { t } from '@src/tutorial/i18n'
// #endregion step:localisation

// #region gateway-events
// When the bot joins a server, it says how to leave feedback
@Controller()
export class WelcomeController {
  @On('guildCreate')
  async welcome(guild: Guild) {
    // The message command's own words, which stay as the pattern has them
    const example = `\`@${guild.client.user.username} feedback idea Add a dark mode\``
    // before:localisation await guild.systemChannel?.send(`Thanks for adding me! Use /feedback, or mention me: ${example}`)
    // #region step:localisation
    const text = t.forGuild(guild)
    // The slash command by its name in the server's language, as members see it
    await guild.systemChannel?.send(text('feedback.welcome', { command: text('feedback.name'), example }))
    // #endregion step:localisation
  }
}
// #endregion gateway-events
