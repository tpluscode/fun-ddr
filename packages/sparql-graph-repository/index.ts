import { Entity, AggregateRoot, Repository } from '@tpluscode/fun-ddr/lib'
import { AggregateRootImpl } from '@tpluscode/fun-ddr/lib/AggregateRootImpl'
import ParsingClient from 'sparql-http-client/ParsingClient'
import { ParsingQuery } from 'sparql-http-client/ParsingQuery'
import { ResultRow } from 'sparql-http-client/ResultParser'
import debug from 'debug'
import ParserJsonld from '@rdfjs/parser-jsonld'
import { frame, fromRDF } from 'jsonld'
import stringToStream from 'string-to-stream'
import rdf from 'rdf-ext'
import { expand } from '@zazuko/rdf-vocabularies'
import uuid from 'uuid'
import { AggregateNotFoundError, ConcurrencyError } from '@tpluscode/fun-ddr/lib/errors'
import { JsonLdArray } from 'jsonld/jsonld-spec'
import { Quad } from 'rdf-js'

const log = debug('fun-ddr:repository')
const logError = log.extend('error')
const parserJsonld = new ParserJsonld()

export class SparqlGraphRepository<S extends Entity> implements Repository<S> {
  private readonly __sparql: ParsingQuery
  private readonly __base: string
  private readonly __context: object
  private readonly __frame: object

  public constructor (sparql: ParsingClient, base: string, context: object, frame: object) {
    log('Initialising SPARQL repository: %O', {
      base,
    })
    this.__sparql = sparql.query
    this.__base = base
    this.__context = context
    this.__frame = frame
  }

  public async save (ar: AggregateRoot<S, any>, version: number): Promise<void> {
    let graphUri = `urn:ddd:root:${uuid()}`
    const state = await ar.state
    if (!state) {
      const error = await ar.error
      log('Cannot save aggregate because %s', error)
      throw new Error(`Failed to save aggregate: ${error}`)
    }
    log('Saving aggregate %s at version %d in graph %s', state['@id'], version, graphUri)

    const id = state['@id']
    const jsonld = {
      '@context': {
        ...this.__context,
        '@base': this.__base,
      },
      ...state,
    }

    let results: ResultRow[]
    try {
      results = await this.__sparql.select(
        `BASE <${this.__base}>
      
      SELECT ?graph ?currentVersion
      WHERE { 
        ?graph <urn:ddd:version> ?currentVersion ;
               <urn:ddd:id> <${id}> .
              
        MINUS {
          ?graph <urn:ddd:deleted> [] .
        }
      }`)
    } catch (e) {
      logError('Failed to read aggregate root: %o', e)
      throw new Error('Failed to read aggregate root')
    }

    if (results.length > 1) {
      const graphUris = results.map(b => b.graph.value)
      logError('Multiple graphs found for aggregate %s: %s', state['@id'], graphUris.join('\n'))
      throw new Error('Failed to save aggregate: Found multiple graphs')
    } else if (results.length > 0) {
      const [{ graph, currentVersion }] = results
      if (!currentVersion) {
        if (version > 1) {
          logError('Cannot save version %d. Previous version appears to have not number', version)
          throw new ConcurrencyError(id, 0, version)
        }
      } else {
        const currentVersionNumber = Number.parseInt(currentVersion.value)
        if (version !== currentVersionNumber + 1) {
          logError('Cannot save version %d where %d already exists', version, currentVersionNumber)
          throw new ConcurrencyError(id, currentVersionNumber, version)
        }
      }

      graphUri = graph.value
    }

    const parsed = await rdf.dataset().import(parserJsonld.import(stringToStream(JSON.stringify(jsonld)) as any))

    await this.__sparql.update(
      `BASE <${this.__base}>

      DELETE WHERE
      {
        GRAPH <${graphUri}> { ?s ?p ?o } 
        <${graphUri}> <urn:ddd:version> ?version .
      };
      
      BASE <${this.__base}>
      INSERT DATA
      {
        GRAPH <${graphUri}> {
          ${parsed.toString()}
        }
        <${graphUri}> <urn:ddd:version> ${version} ;
                      <urn:ddd:id> <${id}> .
      }
    `).catch(e => {
      logError('Failed to save aggregate root: %s', e.message)
      throw new Error('Failed to save aggregate root')
    })

    log('Aggregate root saved')
  }

  public async load (id: string): Promise<AggregateRoot<S, any>> {
    log('Loading aggregate root %s', id)
    let graph: Quad[]
    try {
      graph = await this.__sparql.construct(
        `BASE <${this.__base}>
    
    CONSTRUCT { 
      ?s ?p ?o .
      ?root <urn:ddd:version> ?version .
     } 
    WHERE { 
      GRAPH ?root { ?s ?p ?o }
      ?root <urn:ddd:version> ?version ;
            <urn:ddd:id> <${id}>.
      
      MINUS {
        ?root <urn:ddd:deleted> [] .
      }
    }`)
    } catch (e) {
      logError('Failed to load aggregate root: %o', e)
      throw new Error('Failed to load aggregate root')
    }

    const dataset = await rdf.dataset(graph)
    const jsonldArray: any[] = await fromRDF(dataset.toString() as any) as JsonLdArray

    const jsonld: any = await frame(jsonldArray, {
      '@context': {
        ...this.__context,
        '@base': this.__base,
        'urn:ddd:version': { '@type': expand('xsd:integer') },
      },
      ...this.__frame,
    })

    const state = jsonld['@graph'][0]

    if (state) {
      const version = jsonldArray.find(obj => obj['urn:ddd:version'])['urn:ddd:version'][0]['@value']
      log('Loaded version %d of aggregate %s', version, id)
      return new AggregateRootImpl<S, any>(state, Number.parseInt(version))
    }

    logError('Failed to load aggregate root. Failed to retrieve state object from graph %s', jsonld)
    return new AggregateRootImpl<S, any>(new AggregateNotFoundError(id))
  }

  public async 'delete' (id: string): Promise<void> {
    log('Deleting aggregate root %s', id)
    await this.__sparql.update(
      `BASE <${this.__base}>
      
      DELETE { 
        ?root <urn:ddd:deleted> ?isDeleted .
      } 
      INSERT {
        ?root <urn:ddd:deleted> true .
      }
      WHERE { 
        ?root <urn:ddd:id> <${id}>.
        
        OPTIONAL {
          ?root <urn:ddd:deleted> ?isDeleted .
        }
      }
    `).catch(e => {
      logError('failed to delete: %o', e)
      throw new Error('Failed to load aggregate root')
    })

    log('Deleted successfully')
  }
}
