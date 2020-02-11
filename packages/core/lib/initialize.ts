import { AggregateRoot, DomainEventEmitter, Entity } from './index'
import { AggregateRootImpl } from './AggregateRootImpl'

type AggregateRootInitFunc<T extends Entity, TArguments, TEvents extends Record<string, any>> = (args: TArguments, emitter: DomainEventEmitter<TEvents>) => T | Promise<T>

export function initialize<T extends Entity, TArguments, TEvents extends Record<string, any> = {}> (
  getInitialState: AggregateRootInitFunc<T, TArguments, TEvents>
): (a: TArguments) => AggregateRoot<T, TEvents> {
  return function (args: TArguments) {
    const aggregateRoot = new AggregateRootImpl<T, TEvents>()

    return aggregateRoot.mutation(async () => {
      return getInitialState(args, aggregateRoot)
    })(args)
  }
}
