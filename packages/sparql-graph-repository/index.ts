import { Entity, AggregateRoot, Repository } from '@tpluscode/fun-ddr/lib'
import { AggregateRootImpl } from '@tpluscode/fun-ddr/lib/AggregateRootImpl'
import SparqlHttp from 'sparql-http-client'
import debug from 'debug'
import ParserJsonld from '@rdfjs/parser-jsonld'
import { frame, fromRDF } from 'jsonld'
import stringToStream from 'string-to-stream'
import rdf from 'rdf-ext'
import { expand } from '@zazuko/rdf-vocabularies'
import uuid from 'uuid'
import { AggregateNotFoundError, ConcurrencyError } from '@tpluscode/fun-ddr/lib/errors'
import { JsonLdArray } from 'jsonld/jsonld-spec'

const log = debug('fun-ddr:repository')
const logError = log.extend('error')
const logResponse = log.extend('endpoint')
const parserJsonld = new ParserJsonld()

export class SparqlGraphRepository<S extends Entity> implements Repository<S> {
  private readonly __sparql: SparqlHttp
  private readonly __base: string
  private readonly __context: object
  private readonly __frame: object

  public constructor (sparql: SparqlHttp, base: string, context: object, frame: object) {
    log('Initialising SPARQL repository: %O', {
      base,
    })
    this.__sparql = sparql
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

    const selectRootGraph = await this.__sparql.selectQuery(
      `BASE <${this.__base}>
      
      SELECT ?graph ?currentVersion
      WHERE { 
        ?graph <urn:ddd:version> ?currentVersion ;
               <urn:ddd:id> <${id}> .
              
        MINUS {
          ?graph <urn:ddd:deleted> [] .
        }
      }`)
    if (!selectRootGraph.ok) {
      log('Failed to retrieve current state of aggregate %s. Server response %s', state['@id'], await selectRootGraph.text())
      logResponse('Response was %d: %s', selectRootGraph.status, await selectRootGraph.text())
      throw new Error(`Failed to read aggregate root: '${selectRootGraph.statusText}'`)
    }
    const json = (await selectRootGraph.json())

    if (json.results.bindings.length > 1) {
      const graphUris = json.results.bindings.map(b => b.graph.value)
      logError('Multiple graphs found for aggregate %s: %s', state['@id'], graphUris.join('\n'))
      throw new Error('Failed to save aggregate: Found multiple graphs')
    } else if (json.results.bindings.length > 0) {
      const [{ graph, currentVersion }] = json.results.bindings
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

    const response = await this.__sparql.updateQuery(
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
    `)

    if (!response.ok) {
      logError('Failed to save aggregate root: %s', response.statusText)
      logResponse('Response was %d: %s', response.status, await response.text())
      throw new Error('Failed to save aggregate root')
    }

    log('Aggregate root saved')
  }

  public async load (id: string): Promise<AggregateRoot<S, any>> {
    log('Loading aggregate root %s', id)
    const graph = await this.__sparql.constructQuery(
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
    }`) as any

    if (!graph.ok) {
      logError('Failed to load aggregate root: %s', graph.statusText)
      logResponse('Response was %d: %s', graph.status, await graph.text())
      throw new Error('Failed to load aggregate root')
    }

    const dataset = await rdf.dataset().import(await graph.quadStream())
    const jsonldArray: any[] = await fromRDF(dataset.toString()) as JsonLdArray

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
    const response = await this.__sparql.updateQuery(
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
    `)

    if (!response.ok) {
      logError('failed to delete: %s', response.statusText)
      logResponse('Response was %d: %s', response.status, await response.text())
      throw new Error('Failed to load aggregate root')
    }

    log('Deleted successfully')
  }
}
