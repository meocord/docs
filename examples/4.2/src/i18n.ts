// #region translator
import { createTranslator } from 'meocord/common'
import enUS from '@src/locales/en-US'
import id from '@src/locales/id'

// At module scope: command builders run when their class is decorated
export const t = createTranslator({ default: 'en-US', locales: { 'en-US': enUS, id } })
// #endregion translator
