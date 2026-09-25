import { Service } from 'meocord/decorator'

// #region service
export interface Timeout {
  moderatorId: string
  targetId: string
  minutes: number
  reason: string
}

// Timeouts waiting for their moderator's confirmation, and the log of those carried out
@Service()
export class ModerationService {
  private readonly pending = new Map<string, Timeout>()
  private next = 1
  readonly log: (Timeout & { at: Date })[] = []

  propose(timeout: Timeout): string {
    const id = String(this.next++)
    this.pending.set(id, timeout)
    return id
  }

  /** The proposal, removed so it runs once; undefined when it was already confirmed or cancelled. */
  take(id: string): Timeout | undefined {
    const timeout = this.pending.get(id)
    this.pending.delete(id)
    return timeout
  }

  record(timeout: Timeout): void {
    this.log.push({ ...timeout, at: new Date() })
  }
}
// #endregion service
