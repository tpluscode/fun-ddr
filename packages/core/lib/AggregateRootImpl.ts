import { MutatorFunc } from './mutation'
import { FactoryFunc } from './factory'
import { emit } from './events'
import { AggregateRoot, DomainEventEmitter, Entity, Repository } from './index'

export class AggregateRootImpl<T extends Entity> implements AggregateRoot<T>, DomainEventEmitter {
  private __error: Error | null = null
  private __state: T | null = null
  private readonly __id: string = ''
  private __markedForDeletion = false
  private readonly __events: { name: string; data: unknown }[] = []
  private readonly __previousVersion: number = 0

  public get state () {
    return this.__state
  }

  public get version () {
    return this.__previousVersion
  }

  public constructor (state?: T | Error, version?: number) {
    if (state instanceof Error) {
      this.__error = state
    } else if (state) {
      if (!version || version < 1) {
        this.__error = new Error('Version was missing when initializing state')
        return
      }

      this.__previousVersion = version
      this.__state = state
      this.__id = state['@id']
    }
  }

  public mutation<TCommand> (mutator: MutatorFunc<T, TCommand>): (cmd: TCommand) => this {
    return (cmd: TCommand) => {
      if (!this.__error) {
        try {
          this.__state = mutator(this.__state, cmd, this)
        } catch (e) {
          this.__error = e
        }
      }

      return this
    }
  }

  public factory<TCommand, TCreated extends Entity> (factoryFunc: FactoryFunc<T, TCommand, TCreated>): (cmd: TCommand) => AggregateRoot<TCreated> {
    return (cmd: TCommand) => {
      if (this.__error) {
        return new AggregateRootImpl<TCreated>(this.__error)
      }
      try {
        return factoryFunc(this.__state, cmd)
      } catch (e) {
        return new AggregateRootImpl<TCreated>(e)
      }
    }
  }

  public 'delete' () {
    this.__markedForDeletion = true
    return this
  }

  public commit (repo: Repository<T>): Promise<T> {
    if (!this.__state) {
      return Promise.reject(new Error('Cannot commit null state.'))
    }

    if (!this.__error) {
      return repo.save(this.__state, this.__previousVersion + 1)
        .then(() => {
          if (this.__markedForDeletion) {
            return repo.delete(this.__id)
          }
        })
        .then(() => {
          this.__events.forEach(e => emit(e.name, {
            id: this.__id,
            ...e,
          }))
          return this.__state!
        })
    }

    return Promise.reject(this.__error)
  }

  public emit<T extends Record<string, unknown>, K extends keyof Pick<T, string>> (name: K, data: T[K]) {
    this.__events.push({
      name,
      data,
    })
  }
}
