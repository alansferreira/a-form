# a-form-template

Lightweight Mustache-based templating for interpolating field values into help text and URLs.

```ts
import { renderTemplate, renderUrlTemplate } from "a-form-template";

renderTemplate("Hello {{customer.firstName}}", { customer: { firstName: "Ana" } });
// => "Hello Ana"

renderUrlTemplate("/api/cities?country={{customer.country}}", { customer: { country: "BR & Co" } });
// => "/api/cities?country=BR%20%26%20Co"
```

- `renderTemplate(template, context, escape?)` — renders a logic-less Mustache template against a JSON context. No escaping by default.
- `renderUrlTemplate(template, context)` — same, but percent-encodes each interpolated value (for building URLs/query params).
- `urlEncode(value)` — the escape function used by `renderUrlTemplate`, exported for reuse.
