import { type ChatInputCommandInteraction } from 'discord.js'
import { type ExecutionContext, GuardDeniedError, respond } from 'meocord/common'
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

/** One step of a call, as the home page's pipeline panel shows it. */
export interface TraceEvent {
  stage: 'defer' | 'guard' | 'interceptor:before' | 'pipe' | 'interceptor:after'
  note: string
}

/** What ran, in order, for the spec and the home page's recording to read. */
export const trace: TraceEvent[] = []

/** The users the guard turns away. */
export const BLOCKED_USER = '666666666666666666'

@Guard()
export class MemberGuard implements GuardInterface {
  canActivate(interaction: ChatInputCommandInteraction): boolean {
    trace.push({ stage: 'defer', note: interaction.deferred ? 'deferred' : 'not deferred' })
    if (interaction.user.id === BLOCKED_USER) {
      trace.push({ stage: 'guard', note: 'denied' })
      throw new GuardDeniedError('This command is for members.')
    }
    trace.push({ stage: 'guard', note: 'allowed' })
    return true
  }
}

@Interceptor()
export class TraceInterceptor implements InterceptorInterface {
  async intercept(_context: ExecutionContext, next: CallHandler): Promise<unknown> {
    trace.push({ stage: 'interceptor:before', note: 'before' })
    const result = await next.handle()
    trace.push({ stage: 'interceptor:after', note: 'after' })
    return result
  }
}

@Pipe()
export class TrimPipe implements PipeInterface<string, string> {
  transform(value: string): string {
    const trimmed = value.trim()
    trace.push({ stage: 'pipe', note: `${JSON.stringify(value)} → ${JSON.stringify(trimmed)}` })
    return trimmed
  }
}

@Controller()
export class PipelineSlashController {
  // #region home
  @Command('greet', CommandType.SLASH)
  @Defer()
  @UseGuard(MemberGuard)
  @UseInterceptor(TraceInterceptor)
  @UsePipe('name', TrimPipe)
  async greet(interaction: ChatInputCommandInteraction, { name }: { name: string }) {
    await respond(interaction).send({ content: `Hello, ${name}!` })
  }
  // #endregion home
}
