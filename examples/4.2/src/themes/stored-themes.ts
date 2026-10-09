import { type ThemeOverride } from 'meocord/interface'

// Stand in for the tables a bot keeps the themes its servers' admins and its users picked in
export const guildThemes = new Map<string, ThemeOverride>()
export const userThemes = new Map<string, ThemeOverride>()
