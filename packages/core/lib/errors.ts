/**
 * Error which should be thrown by a repository when it cannot find an aggregate root
 */
export class AggregateNotFoundError extends Error {
  public constructor (id: string) {
    super(`Aggregate ${id} not found or deleted`)
  }
}

/**
 * Error which should be thrown by a repository when an aggregate cannot be saved
 * because it had been saved already by another process
 */
export class ConcurrencyError extends Error {
  public readonly reason: string
  public constructor (id: string, currentVersion: number, desiredVersion: number) {
    super(`Cannot save aggregate ${id}. It has already been modified`)

    this.reason = `Trying to update version ${currentVersion} to ${desiredVersion}`
  }
}

/**
 * A generic error which should be thrown by aggregate root when a command cannot be processed
 * either due to do it being incomplete or attempting to put the aggregate in an illegal state
 */
export class DomainError extends Error {
  public readonly title: string
  public readonly reason: string
  public constructor (id: string, title: string, reason: string) {
    super(`Cannot modify aggregate ${id} into an invalid state`)

    this.title = title
    this.reason = reason
  }
}
