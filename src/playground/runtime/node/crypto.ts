/** `node:crypto` for the Worker: UUIDs from Web Crypto. A hash only names Redis scripts, which no run loads. */
export const randomUUID = () => globalThis.crypto.randomUUID()

export const createHash = () => {
  const hash = { update: () => hash, digest: () => '0'.repeat(40) }
  return hash
}

export default { randomUUID, createHash }
