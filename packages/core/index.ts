import { handler, CoreEvents as CoreEventModels } from './lib/events'

export { initialize } from './lib/initialize'
export { mutate } from './lib/mutation'
export { factory } from './lib/factory'
export { handler } from './lib/events'
export { Entity, Repository } from './lib'
export { DomainError } from './lib/errors'

export const CoreEvents = handler<CoreEventModels>()
