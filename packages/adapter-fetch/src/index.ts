import type {
  AsyncValidationAdapter,
  AsyncValidationAdapterResponse,
  AsyncValidationRequest,
} from "a-form-async-validation";

export interface FetchAdapterOptions {
  readonly id: string;
  readonly endpoint: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly headers?: () => HeadersInit | Promise<HeadersInit>;
  readonly mapRequest?: (request: AsyncValidationRequest) => unknown;
  readonly mapResponse?: (response: Response) => Promise<AsyncValidationAdapterResponse>;
}

export class FetchAsyncValidationAdapter implements AsyncValidationAdapter {
  readonly id: string;
  private readonly endpoint: string;
  private readonly fetchImplementation: typeof globalThis.fetch;
  private readonly headers?: FetchAdapterOptions["headers"];
  private readonly mapRequest: NonNullable<FetchAdapterOptions["mapRequest"]>;
  private readonly mapResponse: NonNullable<FetchAdapterOptions["mapResponse"]>;

  constructor(options: FetchAdapterOptions) {
    this.id = options.id;
    this.endpoint = options.endpoint;
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.headers = options.headers;
    this.mapRequest = options.mapRequest ?? ((request) => ({
      ruleId: request.ruleId,
      fieldPath: request.fieldPath,
      value: request.value,
      dependencyValues: request.dependencyValues,
      trigger: request.trigger,
    }));
    this.mapResponse = options.mapResponse ?? (async (response) => response.json() as Promise<AsyncValidationAdapterResponse>);
  }

  async validate(request: AsyncValidationRequest): Promise<AsyncValidationAdapterResponse> {
    const response = await this.fetchImplementation(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.headers ? await this.headers() : {}),
      },
      body: JSON.stringify(this.mapRequest(request)),
      signal: request.signal,
    });
    if (!response.ok) {
      throw new Error(`Validation endpoint returned HTTP ${response.status}.`);
    }
    return this.mapResponse(response);
  }
}