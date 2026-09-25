import { injectable } from 'tsyringe'

// #region service
// Resolved through tsyringe, which main.ts hands to discordx
@injectable()
export class GreetingService {
  build(name: string): string {
    return `Hello, ${name}!`
  }
}
// #endregion service
