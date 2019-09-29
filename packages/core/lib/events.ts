import { EventEmitter } from 'eventemitter3'
import { DomainEvent } from './index'

const emitter = new EventEmitter()

export function handle<T extends Record<string, any>, K extends keyof Pick<T, string>> (name: K, handler: (ev: DomainEvent<T[K]>) => void) {
  console.log(`Adding handler for event ${name}: ${handler.name}`)
  emitter.on(name, handler)
}

export function emit (name: string, ev: DomainEvent) {
  console.log(`Emitting event ${ev.name} for resource ${ev.id}`)
  emitter.emit(name, ev)
}
