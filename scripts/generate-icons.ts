/**
 * Draws the site's icons with meo-canvas into public/, and app/favicon.ico, which Next serves by
 * convention ahead of `metadata.icons`. The mark itself lives in src/lib/brand/mark.ts.
 * Run `bun run icons` after changing it, and commit the output.
 */
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { Root } from 'meo-canvas'
import { markNode } from '../src/lib/brand/mark'
import { MARK_DARK, markSvg } from '../src/lib/brand/mark-paths'
import { packIco } from './ico'

const PUBLIC = path.join(process.cwd(), 'public')
const APP = path.join(process.cwd(), 'src', 'app')

async function draw(size: number, node: ReturnType<typeof markNode>, backgroundColor?: string): Promise<Buffer> {
  const canvas = await Root({
    width: size,
    height: size,
    backgroundColor,
    justifyContent: 'center',
    alignItems: 'center',
    children: node,
  })
  try {
    return await canvas.toBuffer('png')
  } finally {
    canvas.release()
  }
}

const tile = (size: number, radius?: number) => draw(size, markNode(size, MARK_DARK, radius))

// A full-bleed tile with the mark at 3/4, inside the 80% circle a launcher may crop a maskable icon to.
const maskable = (size: number) => draw(size, markNode((size * 3) / 4, MARK_DARK, 0), MARK_DARK.tile)

const targets: [name: string, render: () => Promise<Buffer>][] = [
  ['icon-512.png', () => tile(512)],
  ['icon-192.png', () => tile(192)],
  ['icon-32.png', () => tile(32)],
  ['icon-maskable-512.png', () => maskable(512)],
  // Apple masks its own corners, so its source is square.
  ['apple-icon.png', () => tile(180, 0)],
]

for (const [name, render] of targets) {
  writeFileSync(path.join(PUBLIC, name), await render())
  console.log(`[icons] ${name}`)
}

writeFileSync(path.join(PUBLIC, 'icon.svg'), `${markSvg()}\n`)
console.log('[icons] icon.svg')

// Each size drawn, not downscaled: a resampled 16px mark smears.
const icoSizes = [16, 32, 48]
const ico = packIco(await Promise.all(icoSizes.map(async size => ({ size, data: await tile(size) }))))
writeFileSync(path.join(APP, 'favicon.ico'), ico)
console.log(`[icons] favicon.ico ${icoSizes.join('/')} (${ico.length}B)`)

const manifest = {
  name: 'MeoCord',
  short_name: 'MeoCord',
  start_url: '/',
  display: 'standalone',
  background_color: '#161618',
  theme_color: '#161618',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
writeFileSync(path.join(PUBLIC, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log('[icons] manifest.webmanifest')
