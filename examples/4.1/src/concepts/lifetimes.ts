import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Guard, Service, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { type GuardInterface } from 'meocord/interface'

// #region lifetimes
// One instance for the whole app: what it holds is shared by every call
@Service()
export class VisitCounter {
  count = 0
}

// A new instance for every call: it holds nothing between them
@Guard()
export class CountingGuard implements GuardInterface {
  static created = 0

  constructor() {
    CountingGuard.created += 1
  }

  canActivate(): boolean {
    return true
  }
}

@Controller()
export class VisitButtonController {
  constructor(private readonly visits: VisitCounter) {}

  @Command('visit', CommandType.BUTTON)
  @UseGuard(CountingGuard)
  async visit(interaction: ButtonInteraction) {
    this.visits.count += 1
    await respond(interaction).send({ content: `Visit number ${this.visits.count}` })
  }
}
// #endregion lifetimes
