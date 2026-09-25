import { Service } from 'meocord/decorator'

export interface AuditEntry {
  /** Undefined for a call no handler was reached for. */
  handler: string | undefined
  /** The params before validation and pipes ran. */
  received: unknown
  /** The params the handler ran with. */
  ran: unknown
}

@Service()
export class AuditLog {
  readonly entries: AuditEntry[] = []

  record(entry: AuditEntry): void {
    this.entries.push(entry)
  }
}
