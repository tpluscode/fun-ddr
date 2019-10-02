declare module '@rdfjs/parser-jsonld' {
  import { Quad, Sink, Stream } from 'rdf-js'
  import { EventEmitter } from 'events'

  export default class ParserJsonld implements Sink<Quad> {
    constructor()

    import(stream: Stream<any>): EventEmitter;
  }
}
