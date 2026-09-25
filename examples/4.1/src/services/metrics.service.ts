// #region service
import { Service } from 'meocord/decorator'
import { type DispatchOutcome } from 'meocord/interface'

// Stands in for a metrics client: counts calls by handler and outcome, and keeps their durations
@Service()
export class MetricsService {
  private readonly counts = new Map<string, number>()
  readonly durations: number[] = []

  record(type: string, handler: string, outcome: DispatchOutcome, durationMs: number) {
    const key = `${type} ${handler} ${outcome}`
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1)
    this.durations.push(durationMs)
  }

  count(type: string, handler: string, outcome: DispatchOutcome) {
    return this.counts.get(`${type} ${handler} ${outcome}`) ?? 0
  }
}
// #endregion service
