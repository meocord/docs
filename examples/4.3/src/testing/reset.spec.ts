import { clearAllMocks, createMockClient, createMockFn, resetAllMocks } from 'meocord/testing'
import { describe, expect, it } from 'vitest'

describe('clearAllMocks and resetAllMocks', () => {
  // #region reset
  it('clears what mocks recorded, and resets what a test told them', async () => {
    const client = createMockClient()
    const notify = createMockFn().mockReturnValue('sent')
    client.users.fetch.mockRejectedValue(new Error('Unknown User'))
    notify()

    // Calls are forgotten; behaviour a test set stays
    clearAllMocks()
    expect(notify.mock.calls).toEqual([])
    expect(notify()).toBe('sent')

    // Behaviour goes back to how each mock was created, the defaults above included
    resetAllMocks()
    expect(notify()).toBeUndefined()
    await expect(client.users.fetch('1')).resolves.toBeDefined()
  })
  // #endregion reset
})
