import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  type GuildMember,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js'

// #region service
// Shared logic lives wherever you put it, and is passed around by hand
export const greetings = {
  build: (name: string) => `Hello, ${name}!`,
}
// #endregion service

// #region register
// Commands are registered by a separate call, usually a script run before starting the bot
const greet = new SlashCommandBuilder()
  .setName('greet')
  .setDescription('Greets someone')
  .addStringOption(option => option.setName('name').setDescription('Who to greet').setRequired(true))

export async function register(token: string, applicationId: string) {
  await new REST().setToken(token).put(Routes.applicationCommands(applicationId), { body: [greet.toJSON()] })
}
// #endregion register

// #region command
// Three uses per ten seconds, per user, kept by hand
const uses = new Map<string, number[]>()

async function onGreet(interaction: ChatInputCommandInteraction) {
  const now = Date.now()
  const recent = (uses.get(interaction.user.id) ?? []).filter(time => now - time < 10_000)
  if (recent.length >= 3) {
    await interaction.reply({ content: 'Slow down.', flags: MessageFlags.Ephemeral })
    return
  }
  uses.set(interaction.user.id, [...recent, now])
  await interaction.reply({ content: greetings.build(interaction.options.getString('name', true)) })
}
// #endregion command

// #region button
// The customId is parsed by hand, and the owner check is part of the handler
async function onRefresh(interaction: ButtonInteraction, ownerId: string) {
  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: 'Only the user who opened this can use it.', flags: MessageFlags.Ephemeral })
    return
  }
  await interaction.update({ content: `Refreshed at ${new Date().toISOString()}` })
}
// #endregion button

// #region client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] })

// One listener receives every interaction, and routes it
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'greet') await onGreet(interaction)
    if (interaction.isButton()) {
      const [scope, ownerId, action] = interaction.customId.split('/')
      if (scope === 'card' && action === 'refresh') await onRefresh(interaction, ownerId)
    }
  } catch (error) {
    console.error(error)
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral })
    }
  }
})

client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
  await member.send(`Welcome to ${member.guild.name}!`)
})

await client.login(process.env.DISCORD_TOKEN)
// #endregion client
