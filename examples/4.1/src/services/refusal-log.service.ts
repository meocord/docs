// #region service
import { Service } from 'meocord/decorator'
import { type DispatchOutcome } from 'meocord/interface'

export interface RefusalEntry {
  user: string
  handler: string
  outcome: DispatchOutcome
  deniedBy?: string
  at: Date
}

// Stands in for a database table or a log channel
@Service()
export class RefusalLog {
  readonly entries: RefusalEntry[] = []

  write(entry: RefusalEntry) {
    this.entries.push(entry)
  }
}
// #endregion service
