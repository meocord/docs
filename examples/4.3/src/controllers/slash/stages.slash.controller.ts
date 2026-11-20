import { type ChatInputCommandInteraction } from 'discord.js'
import { type ExecutionContext, respond } from 'meocord/common'
import {
  Command,
  Controller,
  Defer,
  Guard,
  Interceptor,
  Pipe,
  UseGuard,
  UseInterceptor,
  UsePipe,
} from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { type CallHandler, type GuardInterface, type InterceptorInterface, type PipeInterface } from 'meocord/interface'

/** What ran, in order, for the spec to read. */
export const stages: string[] = []

@Guard()
class RecordingGuard implements GuardInterface {
  canActivate(interaction: ChatInputCommandInteraction): boolean {
    stages.push(`guard, deferred: ${interaction.deferred}`)
    return true
  }
}

@Interceptor()
class RecordingInterceptor implements InterceptorInterface {
  async intercept(_context: ExecutionContext, next: CallHandler): Promise<unknown> {
    stages.push('interceptor, before')
    const result = await next.handle()
    stages.push('interceptor, after')
    return result
  }
}

@Pipe()
class RecordingPipe implements PipeInterface<string, string> {
  transform(value: string): string {
    stages.push('pipe')
    return value.trim()
  }
}

@Controller()
export class StagesSlashController {
  // #region stages
  @Command('stages', CommandType.SLASH)
  @Defer()
  @UseGuard(RecordingGuard)
  @UseInterceptor(RecordingInterceptor)
  @UsePipe('text', RecordingPipe)
  async run(interaction: ChatInputCommandInteraction, { text }: { text: string }) {
    stages.push('handler')
    await respond(interaction).send({ content: text })
  }
  // #endregion stages
}
