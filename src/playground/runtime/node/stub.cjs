// Stands in for a Node or network module mocked dispatch never reaches: fs, net, undici, discord.js's
// gateway. CommonJS, so any named import of it resolves; any property, call or construction gives the stub back.
const stub = new Proxy(function () {}, {
  get: (_target, property) => (property === '__esModule' ? false : property === Symbol.toPrimitive ? () => '' : stub),
  apply: () => stub,
  construct: () => stub,
})

module.exports = stub
