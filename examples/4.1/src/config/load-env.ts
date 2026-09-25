// #region load-env
import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'

// APP_ENV picks the file: .env.dev, .env.staging, .env.prod, resolved from the directory the bot starts in
const file = path.resolve(`.env.${process.env.APP_ENV ?? 'dev'}`)

config({ path: existsSync(file) ? file : path.resolve('.env'), quiet: true })
// #endregion load-env
