# a-form-presentation-bootstrap

Adapter oficial Bootstrap para `a-form-react`, baseado em
`@rjsf/react-bootstrap` e React-Bootstrap.

## Uso

```tsx
import { AForm, PresentationAdapterRegistry } from "a-form-react";
import { BootstrapAdapter } from "a-form-presentation-bootstrap";
import "a-form-presentation-bootstrap/styles.css";

const registry = new PresentationAdapterRegistry();
registry.register(BootstrapAdapter);

<AForm
  spec={spec}
  presentation={{ registry, adapterId: "bootstrap" }}
/>;
```

Instale no host `bootstrap` e `react-bootstrap`. O CSS nao e injetado por
runtime: o import acima deixa o host controlar quando e como o Bootstrap entra
na aplicacao.
