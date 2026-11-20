// #region type
import { type MessageParamType } from 'meocord/interface'

// Named by a key of the app's catalog, so the usage reply names it in the server's language
export const color: MessageParamType<number> = {
  labelKey: 'types.color',
  parse: word => (/^#[0-9a-f]{6}$/i.test(word) ? parseInt(word.slice(1), 16) : undefined),
}
// #endregion type
