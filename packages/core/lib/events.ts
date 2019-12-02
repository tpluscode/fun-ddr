import debug from 'debug'
import { DomainEvent } from './index'

const logger = debug('fun-ddr:events')
const handlers = new Map<string, Array<(ev: any) => void | Promise<void>>>()

export interface CoreEvents {
  AggregateDeleted: {
    types: string[];
  };
}

type PossiblyDomainEvent<T extends Record<string, any>, K extends keyof Pick<T, string>> = unknown extends T[K] ? never : DomainEvent<T[K]>
type Handler<T extends Record<string, any>, K extends keyof Pick<T, string>> = (ev: PossiblyDomainEvent<T, K>) => void | Promise<any>

async function runHandler (handler: (ev: any) => void | Promise<void>, ev: any) {
  const handlerLog = logger.extend(ev.name)
  handlerLog(`Handling started for ${ev.id}`)

  try {
    const result = await handler(ev)
    handlerLog('Handling finished')
    return result
  } catch (e) {
    handlerLog.extend('error')('Error in handler %O', e)
  }
}

async function handlersAndChildren (name: string, promises: Promise<Promise<unknown> | unknown>[]) {
  const resolved = await Promise.all(promises)
  const childPromises = resolved.filter(value => typeof value === 'object' && value !== null && 'then' in value) as Promise<unknown>[]

  if (childPromises.length > 0) {
    await handlersAndChildren(name, childPromises)
  }
}

export function handle<T extends Record<string, any>, K extends keyof Pick<T, string>> (name: K, handler: Handler<T, K>) {
  logger(`Adding handler for event ${name}: ${handler.name}`)

  const handlersOfEvent = handlers.get(name) || []

  handlersOfEvent.push(handler)
  handlers.set(name, handlersOfEvent)

  return (id: string, data: T[K]) => handler({
    id,
    data,
    name,
  } as any as PossiblyDomainEvent<T, K>)
}

export function emit (name: string, ev: DomainEvent<any>) {
  logger(`Emitting event ${ev.name} for resource ${ev.id}`)
  const handlersOfEvent = (handlers.get(name) || [])

  const promises = handlersOfEvent.map(handle => runHandler(handle, ev))

  return handlersAndChildren(name, promises)
}

export function emitImmediate<T extends Record<string, any>, K extends keyof Pick<T, string>> (id: string, name: K, data: unknown extends T[K] ? never : T[K]) {
  return emit(name, {
    id,
    name,
    data,
  })
}
