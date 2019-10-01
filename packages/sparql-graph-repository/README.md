# SPARQL Graph Store for fun-ddr

## Installation

```
npm i --save @tpluscode/fun-ddr-sparql-graph-repository hydra-box
```

## Usage

1. Create a repository

```typescript
import rdfFetch from 'hydra-box/lib/rdfFetch'
import { SparqlGraphRepository } from '@tpluscode/fun-ddr-sparql-graph-repository'
import { expand } from '@zazuko/rdf-vocabularies'

const sparqlClient = new SparqlHttp({
  endpointUrl,
  updateUrl,
  fetch: rdfFetch,
})

// The namespace URI for resources
const base = 'http://my.resource.ns/'

// JSON-LD context document for (de)serializing
const context = {
  '@vocab': 'https://my.vocabulary.ns/',
  name: expand('schema:name'),
}

// A frame used to deserialize triples
const frame  = {
  '@type': 'Person',
}

export const people = new SparqlGraphRepository<T>(sparqlClient, base, context, frame)
```
