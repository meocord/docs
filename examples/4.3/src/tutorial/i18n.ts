// #region translator
import { createTranslator } from 'meocord/common'
import enUS from '@src/tutorial/locales/en-US'
import id from '@src/tutorial/locales/id'

// At module scope: the command builder uses it when its class is decorated
export const t = createTranslator({ default: 'en-US', locales: { 'en-US': enUS, id } })
// #endregion translator
