import { container } from '@sapphire/framework'

// #region service
export class GreetingService {
  build(name: string): string {
    return `Hello, ${name}!`
  }
}

// Shared objects hang off Sapphire's container, typed by augmenting it
declare module '@sapphire/pieces' {
  interface Container {
    greetings: GreetingService
  }
}

container.greetings = new GreetingService()
// #endregion service
