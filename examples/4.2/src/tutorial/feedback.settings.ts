import { Service } from 'meocord/decorator'

// #region settings
// Where feedback goes and who reviews it, read from the environment; tests provide their own
@Service()
export class FeedbackSettings {
  readonly reviewChannelId = process.env.FEEDBACK_CHANNEL_ID ?? ''
  readonly staffRoleId = process.env.STAFF_ROLE_ID ?? ''
}
// #endregion settings
