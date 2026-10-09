import { VERSIONS } from '@/config/versions'
import { newestLine } from '../../scripts/lib/versions'

/**
 * The line the home page draws its examples from, and whose package its quick start installs: the newest line, a
 * release or its betas, as a new bot starts on it. Its examples hold the home page's example, which moves with it.
 */
export const HOME_LINE = newestLine(VERSIONS)

/** The example the home page's pipeline panel shows and runs: a file of HOME_LINE's examples, and its region. */
export const HOME_EXAMPLE = { file: 'home/pipeline.slash.controller.ts', region: 'home' } as const
