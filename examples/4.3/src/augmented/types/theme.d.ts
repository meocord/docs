// #region augment
import 'meocord/interface'
import { type ColorResolvable } from 'discord.js'

declare module 'meocord/interface' {
  interface ThemeColors {
    vip: ColorResolvable
  }
  interface MeoCordTheme {
    charts: { axis: ColorResolvable; series: ColorResolvable[] }
  }
}
// #endregion augment
