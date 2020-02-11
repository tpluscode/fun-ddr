import { MutatorFunc } from './mutation'
import { FactoryFunc } from './factory'
import { CoreEvents, emit } from './events'
import { AggregateRoot, DomainEventEmitter, Entity, Repository } from './index'

export class AggregateRootImpl<T extends Entity, TEvents extends Record<string, any>> implements AggregateRoot<T, TEvents>, DomainEventEmitter<TEvents> {
  private __currentPromise = Promise.resolve()

  private __error: Error | null = null
  private __state: T | null = null
  private __markedForDeletion = false
  private readonly __events: { name: string; data: any }[] = []
  private readonly __previousVersion: number = 0

  public get state () {
    return this.__currentPromise.then(() => this.__state)
  }

  public get error () {
    return this.__currentPromise.then(() => this.__error)
  }

  public get version () {
    return this.__previousVersion
  }

  public get events () {
    return this.__currentPromise.then(() => this.__events)
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
    }
  }

  public mutation<TCommand> (mutator: MutatorFunc<T, TCommand, TEvents>): (cmd: TCommand) => this {
    return (cmd: TCommand) => {
      this.__currentPromise = this.__currentPromise
        .then(async () => {
          if (!this.__error) {
            try {
              this.__state = await mutator(this.__state, cmd, this)
            } catch (e) {
              this.__error = e
            }
          }
        })

      return this
    }
  }

  public factory<TCommand, TCreated extends Entity> (factoryFunc: FactoryFunc<T, TCommand, TCreated, TEvents>): (cmd: TCommand) => Promise<AggregateRoot<TCreated, TEvents>> {
    return async (cmd: TCommand) => {
      if (this.__error) {
        return new AggregateRootImpl<TCreated, TEvents>(this.__error)
      }
      try {
        return factoryFunc(this.__state, cmd)
      } catch (e) {
        return new AggregateRootImpl<TCreated, TEvents>(e)
      }
    }
  }

  public 'delete' () {
    this.__currentPromise = this.__currentPromise
      .then(() => {
        let types: string[] = []
        if (this.__state) {
          if (Array.isArray(this.__state['@type'])) {
            types = this.__state['@type']
          } else {
            types = [this.__state['@type']]
          }
        }

        this.emitFrom<CoreEvents>().AggregateDeleted({
          types,
        })

        this.__markedForDeletion = true
      })

    return this
  }

  async commit<TActual extends Entity> (repo: T extends TActual ? Repository<T> : never): Promise<T> {
    await this.__currentPromise
    if (this.__error) {
      throw this.__error
    }

    if (!this.__state) {
      throw new Error('Cannot commit null state.')
    }

    await repo.save(this as any, this.__previousVersion + 1)

    if (this.__markedForDeletion) {
      await repo.delete(this.__state!['@id'])
    }

    await Promise.all(this.__events.map(e => emit(e.name, {
      id: this.__state!['@id'],
      ...e,
    })))

    return this.__state!
  }

  public get emit (): any {
    return new Proxy(this, {
      get (target: AggregateRootImpl<T, TEvents>, p: string | number | symbol): any {
        return (data: any) => target.__events.push({
          name: p.toString(),
          data,
        })
      },
    })
  }

  public emitFrom<T extends Record<string, any>> () {
    return this.emit
  }
}
