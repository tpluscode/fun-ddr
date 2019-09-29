import { AggregateRoot, DomainEventEmitter, Entity } from './index'
import { AggregateRootImpl } from './AggregateRootImpl'

type AggregateRootInitFunc<T extends Entity, TArguments> = (args: TArguments, emitter: DomainEventEmitter) => T

export function initialize<T extends Entity, TArguments> (
  getInitialState: AggregateRootInitFunc<T, TArguments>
): (a: TArguments) => AggregateRoot<T> {
  return function (args: TArguments) {
    const aggregateRoot = new AggregateRootImpl<T>()

    return aggregateRoot.mutation(() => getInitialState(args, aggregateRoot))(args)
  }
}
