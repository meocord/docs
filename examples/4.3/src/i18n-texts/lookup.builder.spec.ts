import { describe, expect, it } from 'vitest'
import { LookupCommandBuilder } from '@src/i18n-texts/lookup.builder'

describe('LookupCommandBuilder', () => {
  it("fills the translated kind into each locale's description", () => {
    const [user, role] = new LookupCommandBuilder().build('lookup').toJSON().options!

    expect(user!.description).toBe('Look a user up by name')
    expect(user!.description_localizations).toEqual({ id: 'Cari pengguna menurut nama' })
    expect(role!.description_localizations).toEqual({ id: 'Cari peran menurut nama' })
  })
})
