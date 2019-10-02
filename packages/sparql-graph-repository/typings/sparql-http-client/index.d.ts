declare module 'sparql-http-client' {
  import { Term } from 'rdf-js'
  import { Response } from 'node-fetch'

  interface SparqlHttpOptions {
    endpointUrl: string;
    updateUrl: string;
    fetch: any;
  }

  interface SelectBindings {
    results: { bindings: Record<string, Term>[] };
  }

  interface AskResult {
    boolean: boolean;
  }

  interface SelectResponse extends Response {
    json(): Promise<SelectBindings & AskResult>;
  }

  interface ConstructResponse extends Response {
    quadStream(): Promise<any>;
  }

  export default class SparqlHttp {
    public constructor (options: SparqlHttpOptions);
    public updateQuery(query: string, options?: unknown): Promise<Response>;
    public selectQuery(query: string, options?: unknown): Promise<SelectResponse>;
    public constructQuery(query: string, options?: unknown): Promise<ConstructResponse>;
  }
}
