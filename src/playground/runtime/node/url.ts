/** `node:url` over the Worker's URL, with the file-URL helpers a module calls while it loads. */
export const URL = globalThis.URL
export const URLSearchParams = globalThis.URLSearchParams
export const fileURLToPath = (url: string | URL) => String(url).replace(/^file:\/\//, '')
export const pathToFileURL = (path: string) => new globalThis.URL(`file://${path}`)

export default { URL, URLSearchParams, fileURLToPath, pathToFileURL }
