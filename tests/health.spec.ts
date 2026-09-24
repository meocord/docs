import { describe, expect, it, vi } from 'vitest'

// connection() needs a request scope that only Next provides.
vi.mock('next/server', () => ({ connection: async () => undefined }))

describe('/api/health', () => {
  it('reports the build and digest, uncached and noindexed', async () => {
    vi.stubEnv('BUILD_VERSION', 'abc1234')
    vi.stubEnv('IMAGE_DIGEST', 'sha256:feed')
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    expect(await response.json()).toMatchObject({ status: 'ok', version: 'abc1234', digest: 'sha256:feed' })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    vi.unstubAllEnvs()
  })
})
