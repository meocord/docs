// #region guard
import { Guard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'

/** Refuses commands while MAINTENANCE=on. As a global guard it takes interactions only, so events still run. */
@Guard({ types: ['interaction'] })
export class MaintenanceGuard implements GuardInterface {
  canActivate() {
    return process.env.MAINTENANCE !== 'on'
  }
}
// #endregion guard
