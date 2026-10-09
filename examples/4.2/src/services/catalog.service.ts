import { Service } from 'meocord/decorator'

@Service()
export class CatalogService {
  private readonly items = ['admin', 'adventure', 'audit log', 'backup', 'ban list']

  find(text: string): string[] {
    return this.items.filter(item => item.startsWith(text.toLowerCase()))
  }
}
