/**
 * Draws the site's icons with meo-canvas into public/, and app/favicon.ico, which Next serves by
 * convention ahead of `metadata.icons`. The mark is a placeholder until the logo is designed.
 * Run `bun run icons` after changing it, and commit the output.
 */
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { Box, Root } from 'meo-canvas'
import { packIco } from './ico'

const PUBLIC = path.join(process.cwd(), 'public')
const APP = path.join(process.cwd(), 'src', 'app')

const INK = '#0D0E12'
const ACCENT = '#8F9BFF'

async function tile(size: number, radius: number): Promise<Buffer> {
  const unit = size / 32
  // Whole pixels with a floor, so the mark survives a 16px tab strip.
  const dot = Math.max(6, Math.round(14 * unit))
  const canvas = await Root({
    width: size,
    height: size,
    backgroundColor: INK,
    borderRadius: radius * unit,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    children: Box({ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: ACCENT }),
  })
  try {
    return await canvas.toBuffer('png')
  } finally {
    canvas.release()
  }
}

const targets: [name: string, size: number, radius: number][] = [
  ['icon-512.png', 512, 7],
  ['icon-192.png', 192, 7],
  ['icon-32.png', 32, 5],
  // Apple masks its own corners, so its source is square.
  ['apple-icon.png', 180, 0],
]

for (const [name, size, radius] of targets) {
  writeFileSync(path.join(PUBLIC, name), await tile(size, radius))
  console.log(`[icons] ${name} ${size}x${size}`)
}

// Each size drawn, not downscaled: a resampled 16px mark smears.
const icoSizes = [16, 32, 48]
const ico = packIco(await Promise.all(icoSizes.map(async size => ({ size, data: await tile(size, 4) }))))
writeFileSync(path.join(APP, 'favicon.ico'), ico)
console.log(`[icons] favicon.ico ${icoSizes.join('/')} (${ico.length}B)`)

const manifest = {
  name: 'MeoCord',
  short_name: 'MeoCord',
  start_url: '/',
  display: 'standalone',
  background_color: INK,
  theme_color: INK,
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}
writeFileSync(path.join(PUBLIC, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log('[icons] manifest.webmanifest')
