import { EventEmitter } from 'eventemitter3'
import { DomainEvent } from './index'

const emitter = new EventEmitter()

export interface CoreEvents {
  AggregateDeleted: {
    types: string[];
  };
}

type PossiblyDomainEvent<T extends Record<string, any>, K extends keyof Pick<T, string>> = unknown extends T[K] ? never : DomainEvent<T[K]>

export function handle<T extends Record<string, any>, K extends keyof Pick<T, string>> (name: K, handler: (ev: PossiblyDomainEvent<T, K>) => void) {
  console.log(`Adding handler for event ${name}: ${handler.name}`)
  emitter.on(name, handler)

  return (id: string, data: T[K]) => handler({
    id,
    data,
    name,
  } as any as PossiblyDomainEvent<T, K>)
}

export function emit (name: string, ev: DomainEvent) {
  console.log(`Emitting event ${ev.name} for resource ${ev.id}`)
  emitter.emit(name, ev)
}
