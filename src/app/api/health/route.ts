import { connection } from 'next/server'

/**
 * What is running: the commit the image was built from and, when the server sets it at start, the
 * image digest, which the deploy check compares with the one it pulled.
 */
export async function GET() {
  await connection()
  return Response.json(
    {
      status: 'ok',
      version: process.env.BUILD_VERSION ?? 'dev',
      digest: process.env.IMAGE_DIGEST ?? null,
      runtime: process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        // The API is never indexed, whatever the site's setting.
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  )
}
