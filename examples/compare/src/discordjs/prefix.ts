import { Client, Events, GatewayIntentBits } from 'discord.js'

// #region prefix
// A message command is a listener on every message: the prefix, the split and the parsing are the bot's own
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
})

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.content.startsWith('!')) return
  const [name, ...words] = message.content.slice(1).trim().split(/\s+/)
  if (name !== 'roll') return
  const sides = Number(words[0])
  if (!Number.isInteger(sides) || sides < 2) {
    await message.reply('Usage: !roll <sides> [note]')
    return
  }
  const note = words.slice(1).join(' ')
  const result = 1 + Math.floor(Math.random() * sides)
  await message.reply(note ? `${result} (${note})` : String(result))
})
// #endregion prefix
