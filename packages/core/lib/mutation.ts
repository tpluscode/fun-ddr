import { DomainEventEmitter, Entity } from './index'

type CommandRunFunc<T extends Entity, TCommand> = (state: T, cmd: TCommand, emitter: DomainEventEmitter) => T | Promise<T>
export type MutatorFunc<T extends Entity, TCommand> = (state: T | null, cmd: TCommand, emitter: DomainEventEmitter) => Promise<T>

export function mutate<T extends Entity, TCommand> (
  runCommand: CommandRunFunc<T, TCommand>
): MutatorFunc<T, TCommand> {
  return async function (state, cmd, emitter) {
    if (!state) {
      throw new Error('Cannot mutate. State was null')
    }

    return runCommand(state, cmd, emitter)
  }
}
