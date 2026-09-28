import { describe, expect, it } from 'vitest'
import { foreignResources, isForeign } from './built-resources'

describe('isForeign', () => {
  it('leaves a path on the site and a data URL in place, and names any other origin', () => {
    expect(['/logo.svg', 'logo.svg', './a.png', '../b.png', 'data:image/png;base64,AA==', '#x'].map(isForeign)).toEqual(
      [false, false, false, false, false, false],
    )
    expect(
      ['https://img.shields.io/x.svg', 'http://a.test/x', '//cdn.test/x.js', 'javascript:alert(1)'].map(isForeign),
    ).toEqual([true, true, true, true])
  })
})

describe('foreignResources', () => {
  it('names each image, script, frame and media source a page would load from another origin', () => {
    const html = [
      '<p><a href="https://www.npmjs.com/package/meocord"><img src="https://img.shields.io/npm/v/meocord.svg" alt="npm"></a></p>',
      "<img src='/logo.svg'><img src=data:image/png;base64,AA==>",
      '<img srcset="/a.png 1x, https://cdn.test/a@2x.png 2x">',
      '<script src="https://cdn.test/x.js"></script><script src="/_next/static/a.js"></script>',
      '<iframe src="https://www.youtube.com/embed/x"></iframe><video poster="https://v.test/p.jpg"><source src="/v.mp4"></video>',
      '<object data="https://o.test/x.swf"></object>',
    ].join('')
    expect(foreignResources(html)).toEqual([
      '<img src="https://img.shields.io/npm/v/meocord.svg">',
      '<img srcset="https://cdn.test/a@2x.png">',
      '<script src="https://cdn.test/x.js">',
      '<iframe src="https://www.youtube.com/embed/x">',
      '<video poster="https://v.test/p.jpg">',
      '<object data="https://o.test/x.swf">',
    ])
  })

  it('names a fetched link and a stylesheet url, never an anchor, a canonical or a string in a script', () => {
    const html = [
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">',
      '<link rel="icon" href="/favicon.ico"><link rel="canonical" href="https://meocord.dev/docs"><link rel="alternate" href="https://meocord.dev/x">',
      '<a href="https://github.com/meocord/meocord">GitHub</a>',
      '<style>.a{background:url("https://i.test/bg.png")}.b{background:url(/bg.png)}</style>',
      '<div style="background-image:url(https://i.test/inline.png)"></div>',
      '<script>self.__next_f.push(["<img src=\\"https://img.shields.io/x.svg\\">"])</script>',
      '<pre><code>background: url(https://quoted.test/in-text.png)</code></pre>',
    ].join('')
    expect(foreignResources(html)).toEqual([
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">',
      'url(https://i.test/bg.png)',
      'url(https://i.test/inline.png)',
    ])
  })
})
