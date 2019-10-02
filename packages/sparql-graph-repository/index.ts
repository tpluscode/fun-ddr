import { Entity, AggregateRoot, Repository } from '@tpluscode/fun-ddr/lib'
import { AggregateRootImpl } from '@tpluscode/fun-ddr/lib/AggregateRootImpl'
import SparqlHttp from 'sparql-http-client'
import ParserJsonld from '@rdfjs/parser-jsonld'
import SerializerJsonld from '@rdfjs/serializer-jsonld'
import { frame } from 'jsonld'
import stringToStream from 'string-to-stream'
import rdf from 'rdf-ext'
import { expand } from '@zazuko/rdf-vocabularies'
import uuid from 'uuid'

const parserJsonld = new ParserJsonld()
const serializerJsonld = new SerializerJsonld()

export class SparqlGraphRepository<S extends Entity> implements Repository<S> {
  private readonly __sparql: SparqlHttp
  private readonly __base: string
  private readonly __context: object
  private readonly __frame: object

  public constructor (sparql: SparqlHttp, base: string, context: object, frame: object) {
    this.__sparql = sparql
    this.__base = base
    this.__context = context
    this.__frame = frame
  }

  public async save (ar: AggregateRoot<S>, version: number): Promise<void> {
    let graphUri = `urn:ddd:root:${uuid()}`
    const state = await ar.state
    if (!state) {
      throw new Error(`Failed to save aggregate: ${await ar.error}`)
    }

    const id = state['@id']
    const jsonld = {
      '@context': {
        ...this.__context,
        '@base': this.__base,
      },
      ...state,
    }

    const selectRootGraph = await this.__sparql.selectQuery(`
      BASE <${this.__base}>
      
      SELECT ?graph ?currentVersion
      WHERE { 
        ?graph <urn:ddd:version> ?currentVersion ;
               <urn:ddd:id> <${id}> .
              
        MINUS {
          ?graph <urn:ddd:deleted> [] .
        }
      }`)
    const json = (await selectRootGraph.json())

    if (json.results.bindings.length > 1) {
      throw new Error(`Failed to save aggregate: Found multiple graphs: ${json.results.bindings.map(b => b.graph.value).join(', ')}`)
    } else if (json.results.bindings.length > 0) {
      const [{ graph, currentVersion }] = json.results.bindings
      if (!currentVersion) {
        if (version > 1) {
          throw new Error(`Failed to save aggregate: It does not exist but attempting to save version ${version}`)
        }
      } else if (currentVersion && version !== Number.parseInt(currentVersion.value) + 1) {
        throw new Error(`Failed to save aggregate: It has already been modified ${version}`)
      }

      graphUri = graph.value
    }

    const parsed = await rdf.dataset().import(parserJsonld.import(stringToStream(JSON.stringify(jsonld))))

    const response = await this.__sparql.updateQuery(`
      BASE <${this.__base}>

      DELETE WHERE
      {
        GRAPH <${graphUri}> { ?s ?p ?o } 
        <${graphUri}> <urn:ddd:version> ?version .
      };
      
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
      throw new Error(`Failed to save aggregate root: '${response.statusText}'`)
    }
  }

  public async load (id: string): Promise<AggregateRoot<S>> {
    const graph = await this.__sparql.constructQuery(`
    BASE <${this.__base}>
    
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

    const stream = await serializerJsonld.import(await graph.quadStream())

    const jsonldArray: any[] = await new Promise((resolve) => {
      stream.on('data', (jsonld: any) => {
        resolve(jsonld)
      })
    })

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
      const version = jsonldArray.find(obj => obj['urn:ddd:version'])['urn:ddd:version']['@value']
      return new AggregateRootImpl<S>(state, Number.parseInt(version))
    }

    return new AggregateRootImpl<S>(new Error('Resource not found or deleted'))
  }

  public 'delete' (id: string): Promise<any> {
    return this.__sparql.updateQuery(`
      BASE <${this.__base}>
      
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
  }
}
