// The browser package Node's `process` resolves to in the playground's runtime
declare module 'process/browser.js' {
  const process: NodeJS.Process
  export default process
}
