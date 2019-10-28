import { Term } from 'rdf-js'
import { URL } from 'url'

declare namespace SparqlHttp {

  export interface SparqlHttpOptions {
    endpointUrl?: string;
    updateUrl?: string;
  }

  export interface SparqlClientOptions extends SparqlHttpOptions {
    // eslint-disable-next-line no-undef
    fetch?: typeof fetch;
    URL?: typeof URL;
  }

  export interface QueryRequestInit extends SparqlHttpOptions, RequestInit {
  }

  export interface SelectBindings {
    results: { bindings: readonly Record<string, Term>[] };
  }

  export interface AskResult {
    boolean: boolean;
  }

  export interface SelectResponse {
    json(): Promise<SelectBindings & AskResult>;
  }
}

// eslint-disable-next-line no-redeclare
declare class SparqlHttp<TResponse extends Response = Response> {
  public constructor(options?: SparqlHttp.SparqlClientOptions);

  public updateQuery(query: string, options?: SparqlHttp.QueryRequestInit): Promise<Response>;

  public selectQuery(query: string, options?: SparqlHttp.QueryRequestInit): Promise<SparqlHttp.SelectResponse & TResponse>;

  public constructQuery(query: string, options?: SparqlHttp.QueryRequestInit): Promise<TResponse>;
}

export = SparqlHttp;
