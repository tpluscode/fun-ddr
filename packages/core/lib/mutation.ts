import { DomainEventEmitter, Entity } from './index'

type CommandRunFunc<T extends Entity, TCommand, TEvents extends Record<string, any>> = (state: T, cmd: TCommand, emitter: DomainEventEmitter<TEvents>) => T | Promise<T>
export type MutatorFunc<T extends Entity, TCommand, TEvents extends Record<string, any>> = (state: T | null, cmd: TCommand, emitter: DomainEventEmitter<TEvents>) => Promise<T>

export function mutate<T extends Entity, TCommand, TEvents extends Record<string, any> = {}> (
  runCommand: CommandRunFunc<T, TCommand, TEvents>
): MutatorFunc<T, TCommand, TEvents> {
  return async function (state, cmd, emitter) {
    if (!state) {
      throw new Error('Cannot mutate. State was null')
    }

    return runCommand(state, cmd, emitter)
  }
}
