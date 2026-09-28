import { describe, expect, it } from 'vitest'
import { outsideModules } from './modules'

describe('outsideModules', () => {
  it("names each import a reader's code may not make, once, in order", () => {
    const source = `
import { Command } from 'meocord/decorator'
import 'reflect-metadata'
import { Greeter } from '../services/greeter'
import fs from 'node:fs'
import type { Theme } from './theme'
import {
  respond,
} from 'meocord/common'
export { helper } from './helper'
export type { Shape } from './shape'
const lazy = () => import('./lazy')
const old = require("fs")
import { Greeter as Again } from '../services/greeter'
`
    expect(outsideModules(source)).toEqual(['../services/greeter', 'node:fs', './helper', './lazy', 'fs'])
  })

  it('passes a file that imports only the runtime, and ignores import in words and strings', () => {
    expect(
      outsideModules(`import { Client } from 'discord.js'
import { route } from 'meocord/common'
// import { x } from 'nope', in a comment
const text = 'we import nothing here'`),
    ).toEqual([])
  })
})
