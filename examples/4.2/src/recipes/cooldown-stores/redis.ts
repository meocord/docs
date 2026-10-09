import { RedisCooldownStore } from 'meocord/common'

// The two commands the store runs, as any node-redis client has them
interface ScriptCommands {
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>
  evalSha(sha: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>
}

// #region store
// node-redis runs the script; with evalsha it is sent by its SHA1, and in full only when the server lacks it
export const redisCooldownStore = (redis: ScriptCommands) =>
  RedisCooldownStore.using((script, keys, args) => redis.eval(script, { keys, arguments: args }), {
    evalsha: (sha, keys, args) => redis.evalSha(sha, { keys, arguments: args }),
  })
// #endregion store
