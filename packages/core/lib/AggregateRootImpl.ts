import { MutatorFunc } from './mutation'
import { FactoryFunc } from './factory'
import { CoreEvents, emit } from './events'
import { AggregateRoot, DomainEventEmitter, Entity, Repository } from './index'

export class AggregateRootImpl<T extends Entity> implements AggregateRoot<T>, DomainEventEmitter {
  private __currentPromise = Promise.resolve()

  private __error: Error | null = null
  private __state: T | null = null
  private __markedForDeletion = false
  private readonly __events: { name: string; data: any }[] = []
  private readonly __previousVersion: number = 0

  public get state () {
    return this.__state
  }

  public get version () {
    return this.__previousVersion
  }

  public get events () {
    return this.__events
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

  public mutation<TCommand> (mutator: MutatorFunc<T, TCommand>): (cmd: TCommand) => this {
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

  public factory<TCommand, TCreated extends Entity> (factoryFunc: FactoryFunc<T, TCommand, TCreated>): (cmd: TCommand) => Promise<AggregateRoot<TCreated>> {
    return async (cmd: TCommand) => {
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
    this.__currentPromise = this.__currentPromise
      .then(() => {
        let types: string[] = []
        if (this.state) {
          if (Array.isArray(this.state['@type'])) {
            types = this.state['@type']
          } else {
            types = [this.state['@type']]
          }
        }

        this.emit<CoreEvents, 'AggregateDeleted'>('AggregateDeleted', {
          types,
        })

        this.__markedForDeletion = true
      })

    return this
  }

  public commit (repo: Repository<T>): Promise<T> {
    return this.__currentPromise.then(() => {
      if (!this.__state) {
        throw new Error('Cannot commit null state.')
      }

      if (!this.__error) {
        return repo.save(this, this.__previousVersion + 1)
          .then(() => {
            if (this.__markedForDeletion) {
              return repo.delete(this.__state!['@id'])
            }
          })
          .then(() => {
            this.__events.forEach(e => emit(e.name, {
              id: this.__state!['@id'],
              ...e,
            }))
            return this.__state!
          })
      }

      throw this.__error
    })
  }

  public emit<T extends Record<string, any>, K extends keyof Pick<T, string>> (name: K, data: unknown extends T[K] ? never : T[K]) {
    this.__events.push({
      name,
      data,
    })
  }
}
