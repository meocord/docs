import { Service } from 'meocord/decorator'

export interface Account {
  uid: string
  name: string
}

@Service()
export class AccountService {
  private readonly accounts = new Map<string, Account>([['800000001', { uid: '800000001', name: 'Ada' }]])

  find(uid: string): Account {
    const account = this.accounts.get(uid)
    if (!account) throw new Error(`No account ${uid}`)
    return account
  }
}
