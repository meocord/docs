import { defineCatalog } from 'meocord/common'

// #region catalog
export default defineCatalog({
  announce: {
    name: 'announce',
    description: 'Post an announcement',
    message: 'The announcement',
    heading: '📣 Announcement',
    posted: 'Posted. Everyone sees it in the server’s language.',
  },
  welcome: 'Welcome to {server}, {user}!',
})
// #endregion catalog
