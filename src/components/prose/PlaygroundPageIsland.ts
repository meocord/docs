'use client'

import { useEffect } from 'react'
import { parseDispatchList } from '@/playground/dispatch-list'
import type { Editor } from '@/playground/client/editor'
import { decodeShared, encodeShared, tooLongToShare } from '@/playground/share'

/**
 * The playground page's client side. It fills the editor from a share link's fragment, or from the example
 * picked to start from, shows the buttons the server rendered hidden, and on Run loads the runner. Copy link
 * writes the code and inputs into the address, within the length a link carries, and copies it. Once the page
 * is up, a highlighting editor takes the code field's place; the field stays the code's source of truth.
 */
export function PlaygroundPageIsland() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-playground-page]')
    const code = root?.querySelector<HTMLTextAreaElement>('#playground-code')
    const inputs = root?.querySelector<HTMLInputElement>('#playground-inputs')
    const run = root?.querySelector<HTMLButtonElement>('[data-playground-run]')
    const share = root?.querySelector<HTMLButtonElement>('[data-playground-share]')
    const status = root?.querySelector<HTMLElement>('[data-playground-status]')
    const output = root?.querySelector<HTMLElement>('[data-playground-output]')
    const example = root?.querySelector<HTMLSelectElement>('#playground-example')
    const frame = root?.dataset.playgroundSrc
    if (!root || !code || !inputs || !run || !share || !status || !output || !frame) return
    run.hidden = false
    share.hidden = false
    const say = (text: string) => (status.textContent = text)
    let editor: Editor | undefined
    let gone = false
    const setCode = (text: string) => {
      code.value = text
      editor?.set(text)
    }

    if (location.hash)
      void decodeShared(location.hash).then(shared => {
        if (!shared) return say("This link's code couldn't be read, so the playground starts from an example.")
        // Only over the page as served: a reader who began editing before this ran keeps their text
        if (code.value !== code.defaultValue || inputs.value !== inputs.defaultValue)
          return say("This link's code wasn't loaded, so your edits stay. Reload the page to open it.")
        setCode(shared.source)
        inputs.value = shared.dispatch
      })

    const onPick = () => {
      const option = example?.selectedOptions[0]
      if (!option) return
      setCode(option.dataset.source ?? '')
      inputs.value = option.dataset.dispatch ?? ''
      output.replaceChildren()
      say('')
    }

    const onRun = () => {
      say('')
      const list = parseDispatchList(inputs.value)
      if (typeof list === 'string') {
        output.replaceChildren()
        return say(list)
      }
      const request = { source: code.value, dispatch: list.steps, ...(list.caller && { caller: list.caller }) }
      void import('@/playground/client/runner').then(({ runRequest }) => runRequest(frame, request, output, run))
    }

    const onShare = async () => {
      const fragment = await encodeShared({ source: code.value, dispatch: inputs.value })
      const tooLong = tooLongToShare(fragment)
      if (tooLong) return say(tooLong)
      history.replaceState(history.state, '', `#${fragment}`)
      try {
        await navigator.clipboard.writeText(location.href)
        say('Link copied.')
      } catch {
        say('The link is in the address bar; copy it from there.')
      }
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        onRun()
      }
    }

    void import('@/playground/client/editor').then(({ mountEditor }) => {
      if (!gone) editor = mountEditor(code, onRun)
    })

    example?.addEventListener('change', onPick)
    run.addEventListener('click', onRun)
    share.addEventListener('click', onShare)
    code.addEventListener('keydown', onKey)
    inputs.addEventListener('keydown', onKey)
    return () => {
      gone = true
      editor?.destroy()
      example?.removeEventListener('change', onPick)
      run.removeEventListener('click', onRun)
      share.removeEventListener('click', onShare)
      code.removeEventListener('keydown', onKey)
      inputs.removeEventListener('keydown', onKey)
    }
  }, [])
  return null
}
