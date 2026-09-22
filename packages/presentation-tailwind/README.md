# a-form-presentation-tailwind

Adapter de apresentacao para `a-form-react` orientado a Tailwind CSS. O pacote
nao instala nem injeta Tailwind: o host continua responsavel pela pipeline de
CSS e pode substituir o fallback por suas classes utilitarias.

## Uso

```tsx
import { AForm, PresentationAdapterRegistry } from "a-form-react";
import { TailwindAdapter } from "a-form-presentation-tailwind";
import "a-form-presentation-tailwind/styles.css";

const registry = new PresentationAdapterRegistry();
registry.register(TailwindAdapter);

<AForm
  spec={spec}
  presentation={{ registry, adapterId: "tailwind" }}
/>;
```

A especificacao permanece portatil. O adapter define apenas a apresentacao em
runtime; `ui:widget` continua sendo a intencao semantica do controle.
