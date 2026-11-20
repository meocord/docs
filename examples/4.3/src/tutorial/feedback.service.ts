import { type Locale } from 'discord.js'
import { Service } from 'meocord/decorator'
import { FeedbackNotFoundError } from '@src/tutorial/feedback.errors'

// #region service
export interface Feedback {
  id: string
  authorId: string
  // The author's language, so the verdict reaches them in it
  locale: Locale
  about: string
  details: string
  status: 'open' | 'approved' | 'rejected'
}

// Keeps feedback in memory, so a restart forgets it; the database recipe shows the lasting version
@Service()
export class FeedbackService {
  private readonly items = new Map<string, Feedback>()
  private next = 1

  add(entry: Pick<Feedback, 'authorId' | 'locale' | 'about' | 'details'>): Feedback {
    const feedback: Feedback = { ...entry, id: String(this.next++), status: 'open' }
    this.items.set(feedback.id, feedback)
    return feedback
  }

  get(id: string): Feedback {
    const feedback = this.items.get(id)
    if (!feedback) throw new FeedbackNotFoundError(id)
    return feedback
  }

  decide(id: string, status: 'approved' | 'rejected'): Feedback {
    const feedback = this.get(id)
    feedback.status = status
    return feedback
  }
}
// #endregion service
