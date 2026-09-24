import { Mode } from '../enum/index.js';
/**
 * Starts the application.
 *
 * @param mode - How it runs.
 * @example
 * ```ts
 * start(Mode.Production)
 * ```
 */
export declare function start(mode: Mode): Promise<void>;
/** Settings shared by every shard. */
export declare class ShardContext {
    /** Calls a method in every shard. */
    call(method: string): Promise<unknown[]>;
}
