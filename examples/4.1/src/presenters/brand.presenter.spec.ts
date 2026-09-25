import { type ResponseContext } from 'meocord/interface'
import { describe, expect, it } from 'vitest'
import { BrandPresenter } from '@src/presenters/brand.presenter'

describe('BrandPresenter', () => {
  const presenter = new BrandPresenter()
  const context = {} as ResponseContext

  it('titles errors, and shows what the fallback or a filter says', () => {
    expect(presenter.error(context, { message: 'Try again later.' } as never)).toMatchObject({
      title: 'Something went wrong',
      text: 'Try again later.',
    })
  })

  it('shows its own loading text', () => {
    expect(presenter.loading(context)).toMatchObject({ text: 'Hang on…', emoji: '⏳' })
  })
})
