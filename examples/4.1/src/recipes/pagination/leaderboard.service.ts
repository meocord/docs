import { Service } from 'meocord/decorator'

export interface Score {
  name: string
  points: number
}

@Service()
export class LeaderboardService {
  // In a real bot, read from your database
  scores(): Score[] {
    const names = ['Ada', 'Bo', 'Cy', 'Di', 'Ed', 'Flo', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kai', 'Lu']
    return names.map((name, index) => ({ name, points: 1200 - index * 75 }))
  }
}
