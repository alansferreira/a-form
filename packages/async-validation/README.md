# a-form-async-validation

**Remote validation with cancellation, caching, timeouts, and explicit failure policy.**

`a-form-async-validation` is the transport-neutral runtime for AForm async rules. Register adapters once, create an engine per form instance, and run rules from the lifecycle events owned by your UI.

## Install

```bash
npm install a-form-core a-form-async-validation
```

## Register an Adapter

```ts
import {
  AsyncValidationEngine,
  AsyncValidationRegistry,
  type AsyncValidationAdapter,
} from "a-form-async-validation";

const emailAdapter: AsyncValidationAdapter = {
  id: "customer-api",
  async validate(request) {
    const response = await fetch("/api/validate-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: request.value }),
      signal: request.signal,
    });

    return response.json();
  },
};

const registry = new AsyncValidationRegistry();
const unregister = registry.register(emailAdapter);
const engine = new AsyncValidationEngine(registry);
```

Registering the same adapter ID twice throws. The function returned by `register` removes that adapter.

## Run a Rule

```ts
import type { AsyncValidationRuleSpec, JsonObject } from "a-form-core";

const rule: AsyncValidationRuleSpec = {
  id: "email-available",
  adapter: "customer-api",
  paths: ["person.email"],
  dependsOn: ["person.country"],
  triggers: ["blur", "submit"],
  timeoutMs: 5_000,
  cacheTtlMs: 300_000,
  failurePolicy: "block",
};

const formData: JsonObject = {
  person: { email: "hello@example.com", country: "BR" },
};

const result = await engine.run({
  rule,
  fieldPath: "person.email",
  value: "hello@example.com",
  formData,
  trigger: "blur",
});

if (result.blocking) {
  console.error(result.issues);
}
```

## Result States

| Status | Meaning |
| --- | --- |
| `valid` | The adapter accepted the value, or the rule did not apply to this trigger/path |
| `invalid` | The adapter rejected the value |
| `unavailable` | The adapter is missing, timed out, or failed |
| `cancelled` | A newer run replaced the active request |

Every result also exposes:

- `valid`: adapter validity;
- `blocking`: whether submission should be stopped;
- `cached`: whether the adapter response came from the in-memory cache;
- `issues`: optional path-specific messages;
- `metadata`: optional adapter-defined JSON metadata.

## Execution Guarantees

- Default triggers are `blur` and `submit`.
- Default timeout is 5 seconds.
- Starting a new run cancels the previous run for the same rule and field path.
- Cache identity includes rule ID, field path, value, and dependency values.
- Adapter requests receive an `AbortSignal` and should pass it to their transport.
- Missing or unavailable adapters block by default.
- `failurePolicy: "warning"` explicitly makes unavailable or invalid non-error results non-blocking.

## Lifecycle

The engine stores active requests and cache entries in memory. Create one engine for each live form instance, then release its resources when that form is removed:

```ts
engine.cancelAll();
engine.clearCache();
unregister();
```

`debounceMs` is part of the rule contract but the engine does not schedule debouncing. The UI integration should delay `engine.run()` when handling change-triggered rules.

## Bring Your Own Transport

Implement `AsyncValidationAdapter` directly for GraphQL, RPC, local workers, or platform APIs. For standard HTTP POST validation, use `a-form-adapter-fetch`.
