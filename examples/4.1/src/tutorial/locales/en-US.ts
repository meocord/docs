// #region catalog
import { defineCatalog } from 'meocord/common'

export default defineCatalog({
  feedback: {
    name: 'feedback',
    description: 'Send feedback to the staff',
    modal: { title: 'Send feedback', about: 'What is it about?', details: 'Tell us more' },
    thanks: 'Thanks! The staff will read it soon.',
    review: {
      heading: 'Feedback #{id} from {user}',
      approve: 'Approve',
      reject: 'Reject',
      approved: 'Approved by {user}.',
      rejected: 'Rejected by {user}.',
    },
    verdict: {
      approved: 'Your feedback “{about}” was approved. Thank you!',
      rejected: 'Your feedback “{about}” was not taken up this time.',
    },
    staffOnly: 'Only the staff can review feedback.',
    notFound: 'That feedback no longer exists.',
  },
  presenter: { loading: 'Working on it…', failed: 'Something went wrong' },
})
// #endregion catalog
