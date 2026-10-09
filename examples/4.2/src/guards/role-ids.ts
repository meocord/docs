// #region role-ids
// Your server's role IDs, from .env: with Developer Mode on in Discord, right-click a role and choose Copy Role ID.
// discord.js keys a member's roles by ID, and anyone who manages roles can rename one, so guards check IDs.
export const ROLE_IDS = {
  admin: process.env.ADMIN_ROLE_ID ?? '',
  moderator: process.env.MODERATOR_ROLE_ID ?? '',
}
// #endregion role-ids
