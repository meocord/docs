import type { NodeInstance } from '@meonode/ui'
import { pipelineFigure, pipelineMarkdown } from '@/lib/docs/pipeline'

/** A figure a Guide page draws, each form given the page's link resolver. */
export interface GuideFigure {
  /** The figure on the page. */
  draw: (href: (url: string) => string, key?: number) => NodeInstance
  /** The same figure as Markdown, where the page is read as text, as in llms-full.txt. */
  markdown: (href: (url: string) => string) => string
}

/**
 * The figures a Guide page can draw with `::figure{name="…"}`.
 * content:check refuses a name not listed in GUIDE_FIGURES, which a spec keeps equal to these.
 */
export const FIGURES: Readonly<Record<string, GuideFigure>> = {
  pipeline: { draw: pipelineFigure, markdown: pipelineMarkdown },
}
