import { Service } from 'meocord/decorator'

/** Where errors are sent: an error tracker in a real bot. */
@Service()
export class ErrorReporter {
  report(error: unknown, where: string): void {
    console.error(`[${where}]`, error)
  }
}
