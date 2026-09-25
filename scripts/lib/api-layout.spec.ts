import { describe, expect, it } from 'vitest'
import { formatDisplay, modelLayouts } from './api-layout.js'
import { LAYOUT_WIDTH, layoutKey } from '../../src/lib/docs/api-layout.js'
import type { Token } from '../../src/lib/docs/api-model.js'
import { apiModel } from '../../src/lib/docs/api-site.js'

const model = apiModel('4.1')!
const text = (tokens: Token[]) => tokens.map(token => token.text).join('')
const symbol = (entry: string, name: string) => model.symbol(entry, name)!
const nonSpace = (value: string) => value.replace(/\s+/g, '')

describe('formatDisplay', () => {
  it("lays @Command's declaration and returned decorator out over lines, one parameter each", async () => {
    const command = symbol('decorator', 'Command')
    const declaration = (await formatDisplay('declaration', text(command.code[0])))!
    expect(declaration.split('\n').length).toBeGreaterThan(10)
    expect(declaration).toMatch(/^Command<\n {2}CBC extends BuildableCommandType,\n/)
    expect(declaration).toContain('\n  commandName: string,\n  builderOrType: T,\n')
    expect(declaration.split('\n').every(line => line.length <= LAYOUT_WIDTH.declaration)).toBe(true)

    const returns = (await formatDisplay('returns', text(command.signatures[0].returns!.type)))!
    expect(returns).toMatch(
      /^<P extends Record<string, any>, R extends void \| Promise<void>>\(\n {2}target: object,\n/,
    )
    expect(returns).toContain('\n  _descriptor:\n    | TypedPropertyDescriptor<')
    expect(returns.endsWith('\n) => void')).toBe(true)
  })

  it("breaks @UseGuard's parameter type into its union's members at a table cell's width", async () => {
    const guard = symbol('decorator', 'UseGuard')
    expect(await formatDisplay('param', text(guard.signatures[0].params[0].type))).toBe(
      ['(', '  | ((...args: any[]) => GuardInterface)', '  | GuardWithParams', ')[]'].join('\n'),
    )
    expect(await formatDisplay('declaration', text(guard.code[0]))).toBe(
      ['UseGuard(', '  ...guards: (((...args: any[]) => GuardInterface) | GuardWithParams)[]', '): any'].join('\n'),
    )
  })

  it('leaves what fits on one line, such as createMetadata', async () => {
    const metadata = symbol('common', 'createMetadata')
    expect(text(metadata.code[0])).toBe('createMetadata<T>(description?: string): MetadataDecorator<T>')
    expect(await formatDisplay('declaration', text(metadata.code[0]))).toBeUndefined()
    expect(await formatDisplay('returns', text(metadata.signatures[0].returns!.type))).toBeUndefined()
  })

  it('formats a constructor and a type TypeDoc stopped expanding, which TypeScript itself cannot parse', async () => {
    const constructor = symbol('testing', 'TestingModule').members.find(member => member.name === 'constructor')!
    const formatted = (await formatDisplay('member', text(constructor.code[0])))!
    expect(formatted).toMatch(/^new TestingModule\(\n {2}container: Container,\n/)

    const mock = (await formatDisplay('declaration', text(symbol('testing', 'createMock').code[0])))!
    expect(mock).toContain('[K in ... | ... | ...]: ... extends ... ? ... : ...')
    expect(mock.split('\n').length).toBeGreaterThan(5)
  })

  it('changes only spaces, trailing commas and leading bars: every name stays, in order', async () => {
    const display = text(symbol('decorator', 'Command').code[0])
    const formatted = (await formatDisplay('declaration', display))!
    const names = (value: string) => value.match(/[\w$]+/g)
    expect(names(formatted)).toEqual(names(display))
    expect(
      nonSpace(formatted)
        .replace(/,(?=[)>])/g, '')
        .replace(/:\|/g, ':'),
    ).toBe(nonSpace(display))
  })

  it('gives up on what it cannot read', async () => {
    expect(await formatDisplay('returns', `${'Longer'.repeat(20)} <<< not a type`)).toBeUndefined()
  })
})

describe('modelLayouts', () => {
  it('keys each long display by its form and text, and leaves out what fits', async () => {
    const layouts = await modelLayouts(model)
    const command = symbol('decorator', 'Command')
    expect(layouts[layoutKey('declaration', text(command.code[0]))]).toMatch(/^Command<\n/)
    expect(layouts[layoutKey('returns', text(command.signatures[0].returns!.type))]).toMatch(/^<P extends /)
    expect(layouts[layoutKey('declaration', text(symbol('common', 'createMetadata').code[0]))]).toBeUndefined()
  })
})
