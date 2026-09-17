# a-form-adapter-fetch

**Connect AForm async validation to any HTTP endpoint.**

`a-form-adapter-fetch` provides a Fetch API implementation of `AsyncValidationAdapter`. It supports dynamic headers, custom request mapping, custom response mapping, injectable `fetch`, and request cancellation.

[Open the AForm Playground](https://alansferreira.github.io/a-form/) to compose and preview AForm specifications in the browser.

## Install

```bash
npm install a-form-async-validation a-form-adapter-fetch
```

## Create and Register an Adapter

```ts
import { FetchAsyncValidationAdapter } from "a-form-adapter-fetch";
import {
  AsyncValidationEngine,
  AsyncValidationRegistry,
} from "a-form-async-validation";

const registry = new AsyncValidationRegistry();

registry.register(new FetchAsyncValidationAdapter({
  id: "customer-api",
  endpoint: "https://api.example.com/forms/validate",
  headers: async () => ({
    authorization: `Bearer ${await getAccessToken()}`,
  }),
}));

const engine = new AsyncValidationEngine(registry);
```

## Default HTTP Contract

The adapter sends a `POST` request with `content-type: application/json` and this body:

```json
{
  "ruleId": "email-available",
  "fieldPath": "person.email",
  "value": "hello@example.com",
  "dependencyValues": {
    "person.country": "BR"
  },
  "trigger": "blur"
}
```

The endpoint must return an `AsyncValidationAdapterResponse`:

```json
{
  "valid": false,
  "issues": [
    {
      "code": "EMAIL_TAKEN",
      "message": "This email is already registered.",
      "path": "person.email",
      "severity": "error"
    }
  ]
}
```

Non-success HTTP status codes are thrown and converted by `AsyncValidationEngine` into an `unavailable` result.

## Map a Custom API

Keep a legacy or domain-specific API behind explicit mapping functions:

```ts
const adapter = new FetchAsyncValidationAdapter({
  id: "legacy-customer-api",
  endpoint: "/legacy/check-email",
  mapRequest: (request) => ({
    address: request.value,
    country: request.dependencyValues["person.country"],
  }),
  mapResponse: async (response) => {
    const payload = await response.json() as {
      available: boolean;
      reason?: string;
    };

    return {
      valid: payload.available,
      issues: payload.available ? [] : [{
        code: "EMAIL_TAKEN",
        message: payload.reason ?? "Email is unavailable.",
        path: "person.email",
        severity: "error",
      }],
    };
  },
});
```

## Options

| Option | Required | Purpose |
| --- | --- | --- |
| `id` | Yes | Registry identifier referenced by AForm rules |
| `endpoint` | Yes | Validation endpoint URL |
| `fetch` | No | Custom Fetch API implementation |
| `headers` | No | Per-request header factory with a sync or async result |
| `mapRequest` | No | Converts an engine request into a JSON request body |
| `mapResponse` | No | Converts an HTTP response into an adapter response |

## Runtime Boundaries

- The runtime must provide the Fetch API, or you must inject a compatible implementation.
- The adapter forwards the engine's `AbortSignal` to `fetch`.
- CORS policy is controlled by your endpoint and browser environment.
- Header factories execute for every request; cache expensive token work outside the adapter.
- Response payloads are trusted after mapping. Validate untrusted response shapes inside `mapResponse` when needed.
- Credentials and endpoints belong in application configuration, never in an AForm specification.
