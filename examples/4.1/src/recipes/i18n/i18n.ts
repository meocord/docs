import { createTranslator } from 'meocord/common'
import enUS from '@src/recipes/i18n/en-US'
import id from '@src/recipes/i18n/id'

export const t = createTranslator({ default: 'en-US', locales: { 'en-US': enUS, id } })
