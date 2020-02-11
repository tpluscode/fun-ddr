import debug from 'debug'
import { DomainEvent } from './index'

const logger = debug('fun-ddr:events')
const handlers = new Map<string, Array<(ev: any) => void | Promise<void>>>()

export interface CoreEvents {
  AggregateDeleted: {
    types: string[];
  };
}

type Handler<T> = (ev: DomainEvent<T>) => void | Promise<any>

async function runHandler (handler: (ev: any) => void | Promise<void>, ev: any) {
  const handlerLog = logger.extend(ev.name)
  handlerLog(`Calling handler ${handler.name || 'anonymous'}(${ev.id})`)

  try {
    return await handler(ev)
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

type HandlerMap<T extends Record<string, any>> = {
  readonly [P in keyof T]: (handler: Handler<T[P]>) => (id: string, data: T[P]) => void | Promise<any>;
}

export function handler<T extends Record<string, any>> (): { on: HandlerMap<T> } {
  return {
    on: new Proxy({}, {
      get (target: {}, p: string | number | symbol): any {
        return (handler: any) => {
          const name = p.toString()

          logger(`Adding handler for event ${name}: ${handler.name}`)

          const handlersOfEvent = handlers.get(name) || []

          handlersOfEvent.push(handler)
          handlers.set(name, handlersOfEvent)

          return (id: string, data: unknown) => handler({
            id,
            data,
            name,
          })
        }
      },
    }) as any,
  }
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
