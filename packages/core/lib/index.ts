import { MutatorFunc } from './mutation'
import { FactoryFunc } from './factory'

export interface AggregateRoot<TState extends Entity, TEvents extends Record<string, any>> {
  state: Promise<TState | null>;
  error: Promise<Error | null>;
  version: number;
  events: Promise<{ name: keyof TEvents; data: any }[]>;

  mutation<TCommand>(mutator: MutatorFunc<TState, TCommand, TEvents>): (cmd: TCommand) => AggregateRoot<TState, TEvents>;

  factory<TCommand, TCreated extends Entity>(factoryFunc: FactoryFunc<TState, TCommand, TCreated, TEvents>): (cmd: TCommand) => Promise<AggregateRoot<TCreated, TEvents>>;

  commit<T extends Entity>(repo: TState extends T ? Repository<T> : never): Promise<TState>;

  'delete'(): AggregateRoot<TState, TEvents>;
}

export interface DomainEvent<T = unknown> {
  name: string;
  data: T;
  id: string;
}

export interface Entity {
  '@id': string;
  '@type': string | string[];
}

type EventEmit<TE> = {
  readonly [P in keyof TE]: (data: TE[P]) => void;
}

export interface DomainEventEmitter<TE extends Record<string, any>> {
  readonly emit: EventEmit<TE>;
  emitFrom<T extends Record<string, any>>(): EventEmit<T>;
}

export interface Repository<S extends Entity> {
  save(ar: AggregateRoot<S, any>, version: number): Promise<void>;

  load(id: string): Promise<AggregateRoot<S, any>>;

  'delete'(id: string): Promise<void>;
}
