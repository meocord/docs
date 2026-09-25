import 'reflect-metadata'
import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { GatewayIntentBits } from 'discord.js'
import { NecordModule } from 'necord'
import { CardComponent } from './card.component'
import { GreetCommand } from './greet.command'
import { GreetingService } from './greeting.service'
import { WelcomeListener } from './welcome.listener'

// #region module
// A Nest module lists every provider, handlers included; Necord finds the decorated ones among them
@Module({
  imports: [
    NecordModule.forRoot({
      token: process.env.DISCORD_TOKEN!,
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    }),
  ],
  providers: [GreetingService, GreetCommand, CardComponent, WelcomeListener],
})
class AppModule {}

await NestFactory.createApplicationContext(AppModule)
// #endregion module
