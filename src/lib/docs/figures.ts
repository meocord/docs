import type { NodeInstance } from '@meonode/ui'
import { pipelineFigure } from '@/lib/docs/pipeline'

/**
 * The figures a Guide page can draw with `::figure{name="…"}`, each given the page's link resolver.
 * content:check refuses a name not listed in GUIDE_FIGURES, which a spec keeps equal to these.
 */
export const FIGURES: Readonly<Record<string, (href: (url: string) => string, key?: number) => NodeInstance>> = {
  pipeline: pipelineFigure,
}
