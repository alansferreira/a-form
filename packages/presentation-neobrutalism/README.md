# a-form-presentation-neobrutalism

Preset visual autocontido para `a-form-react`, com bordas marcadas, sombras
solidas e controles nativos acessiveis.

## Uso

```tsx
import { AForm, PresentationAdapterRegistry } from "a-form-react";
import { NeobrutalismAdapter } from "a-form-presentation-neobrutalism";
import "a-form-presentation-neobrutalism/styles.css";

const registry = new PresentationAdapterRegistry();
registry.register(NeobrutalismAdapter);

<AForm
  spec={spec}
  presentation={{ registry, adapterId: "neobrutalism" }}
/>;
```

O adapter altera somente a apresentacao em runtime. A `FormSpec` continua
portatil e nao recebe CSS, JSX ou referencia ao tema.
