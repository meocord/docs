// #region type
import { type MessageParamType } from 'meocord/interface'

/** `#5865F2` as a number, for a pattern's `{accent:color}`. */
export const color: MessageParamType<number> = {
  label: 'hex colour',
  parse: word => (/^#[0-9a-f]{6}$/i.test(word) ? parseInt(word.slice(1), 16) : undefined),
}

// What each of the app's own types gives, so a handler using it is typed
declare module 'meocord/interface' {
  interface MessageParamTypes {
    color: number
  }
}
// #endregion type
