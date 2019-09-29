import { AggregateRoot, DomainEventEmitter, Entity } from './index'
import { AggregateRootImpl } from './AggregateRootImpl'

type FactoryMethodImpl<T extends Entity, TCommand, TCreated extends Entity> = (state: T, command: TCommand, emitter: DomainEventEmitter) => TCreated
export type FactoryFunc<T extends Entity, TCommand, TCreated extends Entity> = (parent: T | null, cmd: TCommand) => AggregateRoot<TCreated>

export function factory<T extends Entity, TCommand, TCreated extends Entity> (
  runFactory: FactoryMethodImpl<T, TCommand, TCreated>
): FactoryFunc<T, TCommand, TCreated> {
  return (parent, cmd) => {
    if (!parent) {
      throw new Error('Cannot run factory method. Parent state was null')
    }

    try {
      const ar = new AggregateRootImpl<TCreated>()
      return ar.mutation<TCommand>((a, cmd, emitter) => {
        return runFactory(parent, cmd, emitter) as TCreated
      })(cmd)
    } catch (error) {
      return new AggregateRootImpl<TCreated>(error)
    }
  }
}
