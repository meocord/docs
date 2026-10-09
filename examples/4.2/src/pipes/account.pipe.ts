// #region pipe
import { Pipe } from 'meocord/decorator'
import { type PipeInterface } from 'meocord/interface'
import { type Account, AccountService } from '@src/services/account.service'

// Resolved like a service, so it can inject one; one instance serves every call
@Pipe()
export class AccountPipe implements PipeInterface<string, Account> {
  constructor(private readonly accounts: AccountService) {}

  transform(uid: string): Account {
    return this.accounts.find(uid)
  }
}
// #endregion pipe
