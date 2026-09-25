import { describe, expect, it } from 'vitest'
import { cardHash, findCard, ogImage, ogPath, parseCardFile } from '@/lib/og/cards'

describe('og cards', () => {
  it('puts the content hash in the path', () => {
    const card = findCard('site', 'home')!
    expect(ogPath('site', 'home')).toBe(`/og/site/home.${cardHash(card)}.png`)
    expect(cardHash(card)).toMatch(/^[0-9a-f]{12}$/)
  })

  it('changes the hash with the content', () => {
    expect(cardHash({ eyebrow: 'a', title: 'b' })).not.toBe(cardHash({ eyebrow: 'a', title: 'c' }))
    expect(cardHash({ eyebrow: 'a', title: 'b' })).not.toBe(cardHash({ eyebrow: 'a', title: 'b', version: '4.0' }))
    expect(cardHash({ eyebrow: 'a', title: 'b' })).not.toBe(cardHash({ eyebrow: 'a', title: 'b', summary: 's' }))
    expect(cardHash({ eyebrow: 'a', title: 'b' })).not.toBe(cardHash({ eyebrow: 'a', title: 'b', code: 'c' }))
  })

  it('finds only registered cards, never inherited keys', () => {
    expect(findCard('site', 'missing')).toBeUndefined()
    expect(findCard('4.9', 'home')).toBeUndefined()
    expect(findCard('site', 'constructor')).toBeUndefined()
    expect(findCard('__proto__', 'home')).toBeUndefined()
    expect(() => ogPath('site', 'missing')).toThrow('No OG card for site/missing.')
  })

  it('describes the image for metadata', () => {
    expect(ogImage('site', 'home')).toMatchObject({ width: 1200, height: 630, alt: expect.not.stringContaining('\n') })
  })

  it('parses only <id>.<hash>.png', () => {
    expect(parseCardFile('home.0123456789ab.png')).toEqual({ id: 'home', hash: '0123456789ab' })
    expect(parseCardFile('home.png')).toBeUndefined()
    expect(parseCardFile('home.0123456789AB.png')).toBeUndefined()
    expect(parseCardFile('../home.0123456789ab.png')).toBeUndefined()
    expect(parseCardFile('home.0123456789ab.png?x')).toBeUndefined()
  })
})
