# Functional, domain-driven resources
Functional and unimposing foundation for architecture resembling CQRS; could be useful for DDD

## Intro

By using fun-ddr (pronounced founder), you can reduce the complexity of individual pieces of your
software and reconnect them with a little infrastructural code.

## Quick guide

### Implementing domain

1. Define aggregate state

```typescript
import { Entity } from '@tpluscode/fun-ddr'

interface Person extends Entity {
  firstName: string;
  lastName: string;
  spouseId?: string;
}
```

2. Create a function to create a first aggregate root

```typescript
import { initialize } from '@tpluscode/fun-ddr'

interface CreatePersonCommand {
  firstName: string;
  lastName: string;
}

const createPerson = initialize<Person, CreatePersonCommand>(cmd => {
  return {
    '@id': '/person/${cmd.firstName}/${cmd.firstName}',
    '@type': 'Person',
    firstName: cmd.firstName,
    lastName: cmd.lastName,
  }
})
```

3. Create a function to mutate the state

```typescript
import { mutate } from '@tpluscode/fun-ddr'

interface MarriageCommand = {
  spouseId: string;
  
}

const marry = mutate<Person, MarriageCommand>((self, command) => {
  if (self.spouseId) {
    throw new Error(`${self.firstName} ${self.lastName} is already married!`)
  }

  return {
    ...self,
    spouseId: command.spouseId,
  }
})
```

4. Consume domain code in your application

```typescript
import { Request, Response, NextFunction } from 'express'
import { people } from './repository/people'

function putPersonRequest (req: Request, res: Response, next: NextFunction) {
  createPerson({
    firstName: req.params.firstName,
    lastName: req.params.lastName,
  })
    .commit(people)
    .then(created => {
      res.status(201)
      res.setLink('Location', created['@id'])
      next()
    })
    .catch(next)
}

async function postMarriageRequest (req: Request, res: Response, next: NextFunction) {
  const person = await people.load(`/person/$req.params.firstName}/${req.params.lastName}`)
  
  person.mutate(marry)({ spouseId: 'some other person' })
    .commit(people)
    .then(() => {
      next()
    })
    .catch(next)
}
```
