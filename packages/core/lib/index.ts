import { MutatorFunc } from './mutation'
import { FactoryFunc } from './factory'

export interface AggregateRoot<TState extends Entity> {
  state: Promise<TState | null>;
  error: Promise<Error | null>;
  version: number;
  events: Promise<{ name: string; data: any }[]>;

  mutation<TCommand>(mutator: MutatorFunc<TState, TCommand>): (cmd: TCommand) => AggregateRoot<TState>;

  factory<TCommand, TCreated extends Entity>(factoryFunc: FactoryFunc<TState, TCommand, TCreated>): (cmd: TCommand) => Promise<AggregateRoot<TCreated>>;

  commit(repo: Repository<TState>): Promise<TState>;

  'delete'(): AggregateRoot<TState>;
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

export interface DomainEventEmitter {
  emit<T extends Record<string, any>, K extends keyof Pick<T, string>>(name: K, value: unknown extends T[K] ? never : T[K]): void;
}

export interface Repository<S extends Entity> {
  save(ar: AggregateRoot<S>, version: number): Promise<void>;

  load(id: string): Promise<AggregateRoot<S>>;

  'delete'(id: string): Promise<void>;
}
