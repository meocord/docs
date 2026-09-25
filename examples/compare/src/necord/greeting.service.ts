import { Injectable } from '@nestjs/common'

// #region service
@Injectable()
export class GreetingService {
  build(name: string): string {
    return `Hello, ${name}!`
  }
}
// #endregion service
