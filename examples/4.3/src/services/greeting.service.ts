import { Service } from 'meocord/decorator'

// #region service
@Service()
export class GreetingService {
  buildGreeting(name: string): string {
    return `Hello, ${name}!`
  }
}
// #endregion service
