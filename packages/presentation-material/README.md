# a-form-presentation-material

Adapter oficial Material UI para `a-form-react`, baseado em `@rjsf/mui`.

## Uso

```tsx
import { AForm, PresentationAdapterRegistry } from "a-form-react";
import { MaterialAdapter } from "a-form-presentation-material";

const registry = new PresentationAdapterRegistry();
registry.register(MaterialAdapter);

<AForm
  spec={spec}
  presentation={{ registry, adapterId: "material" }}
/>;
```

Instale no host `@mui/material`, `@emotion/react` e `@emotion/styled`. O
adapter reutiliza os widgets, templates e fields oficiais do RJSF MUI, incluindo
os estados e o comportamento de label do Material UI.
