declare module '@rdfjs/serializer-jsonld' {
  import { Quad, Sink, Stream } from 'rdf-js'
  import { EventEmitter } from 'events'

  export default class SerializerJsonld implements Sink<Quad> {
    constructor()

    import(stream: Stream<Quad>): EventEmitter;
  }
}
