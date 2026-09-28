import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/** How long a page's animations may run before axe measures it anyway. */
const SETTLE_LIMIT_MS = 5_000

/**
 * Waits for every animation on the document's clock to finish, so axe never measures a frame mid-fade:
 * a colour in transition fails a contrast its settled value passes. An infinite animation and one driven
 * by scrolling never finish, so they're left out, and the wait is bounded for a page under load.
 */
export async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async limit => {
    const finite = document
      .getAnimations()
      .filter(
        animation =>
          animation.timeline === document.timeline &&
          animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY,
      )
    // A cancelled animation's `finished` rejects; it's settled all the same
    const finished = Promise.all(finite.map(animation => animation.finished.catch(() => undefined)))
    await Promise.race([finished, new Promise(resolve => setTimeout(resolve, limit))])
  }, SETTLE_LIMIT_MS)
}

/** axe's results for the page once its animations have settled, with `configure` choosing the rules and scope. */
export async function axe(page: Page, configure: (builder: AxeBuilder) => AxeBuilder = builder => builder) {
  await settleAnimations(page)
  return configure(new AxeBuilder({ page })).analyze()
}
