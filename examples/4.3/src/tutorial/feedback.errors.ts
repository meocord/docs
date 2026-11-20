// #region error
/** Thrown for a feedback id the service does not hold, such as a button left from before a restart. */
export class FeedbackNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`No feedback #${id}`)
  }
}
// #endregion error
