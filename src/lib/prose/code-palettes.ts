/**
 * Editor colours drawn from the site's palette, one hue per kind of token, each at 4.5:1 or better on
 * every surface code is drawn on in its mode, lit and stopped lines included (checked in tokens.spec.ts).
 */
export const CODE_PALETTES = {
  dark: {
    background: '#161618',
    plain: '#E2E2E6',
    comment: '#90909A',
    keyword: '#8C98FF',
    decorator: '#F29CCB',
    string: '#6CCB91',
    regex: '#F07A72',
    number: '#F4A261',
    type: '#5FD3C6',
    func: '#EBD27A',
    operator: '#7FBFEA',
    punct: '#A8A8B2',
  },
  light: {
    background: '#F2F2F4',
    plain: '#26262A',
    comment: '#66666E',
    keyword: '#4150CC',
    decorator: '#A3317A',
    string: '#1E7542',
    regex: '#B3322B',
    number: '#A1510B',
    type: '#0E7169',
    func: '#7A5A00',
    operator: '#1C6A99',
    punct: '#55555C',
  },
} as const
