import { EventEmitter } from 'eventemitter3'
import debug from 'debug'
import { DomainEvent } from './index'

const logger = debug('fun-ddr:events')
const emitter = new EventEmitter()

export interface CoreEvents {
  AggregateDeleted: {
    types: string[];
  };
}

type PossiblyDomainEvent<T extends Record<string, any>, K extends keyof Pick<T, string>> = unknown extends T[K] ? never : DomainEvent<T[K]>

export function handle<T extends Record<string, any>, K extends keyof Pick<T, string>> (name: K, handler: (ev: PossiblyDomainEvent<T, K>) => void | Promise<any>) {
  logger(`Adding handler for event ${name}: ${handler.name}`)

  const handlerLog = logger.extend(name)
  emitter.on(name, async (ev: PossiblyDomainEvent<T, K>) => {
    handlerLog('Handling started')

    try {
      await handler(ev)
    } catch (e) {
      handlerLog.extend('error')('Error in handler %O', e)
      return
    }

    handlerLog('Handling finished')
  })

  return (id: string, data: T[K]) => handler({
    id,
    data,
    name,
  } as any as PossiblyDomainEvent<T, K>)
}

export function emit (name: string, ev: DomainEvent) {
  logger(`Emitting event ${ev.name} for resource ${ev.id}`)
  emitter.emit(name, ev)
}
