import { AggregateRoot, DomainEventEmitter, Entity } from './index'
import { AggregateRootImpl } from './AggregateRootImpl'

type FactoryMethodImpl<T extends Entity, TCommand, TCreated extends Entity, TEvents extends Record<string, any>> = (state: T, command: TCommand, emitter: DomainEventEmitter<TEvents>) => TCreated | Promise<TCreated>
export type FactoryFunc<T extends Entity, TCommand, TCreated extends Entity, TEvents extends Record<string, any>> = (parent: T | null, cmd: TCommand) => Promise<AggregateRoot<TCreated, TEvents>>

export function factory<T extends Entity, TCommand, TCreated extends Entity, TEvents extends Record<string, any>> (
  runFactory: FactoryMethodImpl<T, TCommand, TCreated, TEvents>
): FactoryFunc<T, TCommand, TCreated, TEvents> {
  return async (parent, cmd) => {
    if (!parent) {
      throw new Error('Cannot run factory method. Parent state was null')
    }

    try {
      const ar = new AggregateRootImpl<TCreated, TEvents>()
      return await ar.mutation<TCommand>(async (a, cmd, emitter) => {
        return runFactory(parent, cmd, emitter)
      })(cmd)
    } catch (error) {
      return new AggregateRootImpl<TCreated, TEvents>(error)
    }
  }
}
