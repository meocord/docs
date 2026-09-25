import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { databaseProvider } from '@src/recipes/database/database'
import { NotesController } from '@src/recipes/database/notes.controller'

// #region app
@MeoCord({
  controllers: [NotesController],
  // NotesStore is bound because the controller injects it; the pool it injects comes from here
  providers: [databaseProvider],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
})
export default class App {}
// #endregion app
