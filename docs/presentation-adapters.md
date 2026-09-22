# Adapters de apresentacao para widgets

## Objetivo

Manter a `FormSpec` portatil e sem HTML, JSX ou CSS executavel. O
`uiSchema.ui:widget` existente continua sendo o identificador semantico do
widget. Em runtime, `a-form-react` resolve esse identificador por meio de um
`PresentationAdapterRegistry`.

O renderer preserva layout, filtragem de campos e validacao assincrona em
wrappers proprios, enquanto delega markup, labels, widgets e estados visuais ao
adapter. O primeiro incremento cobre Material e Bootstrap por integracoes RJSF
oficiais, Tailwind por um adapter orientado as classes do host e Neobrutalism
por adapter e CSS autocontidos.

Legenda: `[x]` concluido, `[~]` parcialmente concluido, `[ ]` pendente.

## Status de implementacao

- [~] Contrato `PresentationAdapter`, registry runtime e composicao inicial no
   `a-form-react`.
- [x] Adapters autocontidos `a-form-presentation-tailwind` e
   `a-form-presentation-neobrutalism`, conectados ao `playground-v2`.
- [x] Adapters oficiais `a-form-presentation-material` e
   `a-form-presentation-bootstrap`, conectados ao `playground-v2` com suas
   dependencias opcionais.

## Fase 1: contrato e composicao do renderer

1. [~] Definir em `packages/react/src/presentation.ts` os tipos publicos
   `PresentationAdapter`, `PresentationAdapterRegistry` e a configuracao de
   `AForm`: ID estavel, registries RJSF (`fields`, `widgets`, `templates`),
   provider opcional, classe raiz e metadados de CSS e dependencias. O registry
   deve rejeitar IDs duplicados, resolver por ID e permitir unregister e list.
   Na ausencia de configuracao, o renderer RJSF atual deve ser preservado.
2. [ ] Refatorar `createFieldTemplate` e `createObjectFieldTemplate` em
   `packages/react/src/AForm.tsx` para serem decorators estruturais. Eles
   continuam decidindo visibilidade, `data-a-form-field`, span, ordem,
   flattening de objetos e mensagens assincronas, mas delegam o conteudo
   interno ao `FieldTemplate` ou `ObjectFieldTemplate` do adapter. Isso permite
   ao Material controlar label flutuante, foco, valor, erro e disabled sem
   duplicar labels.
3. [x] Adicionar a prop `presentation` a `AFormProps`, contendo registry e adapter
   ID. Resolver o adapter uma vez por render e combinar seus `fields`, `widgets`
   e demais templates com os wrappers obrigatorios do AForm. Um ID desconhecido
   deve produzir uma mensagem explicita. O componente nao deve carregar CSS
   dinamicamente, preservando SSR e CSP.
4. [x] Exportar os contratos em `packages/react/src/index.ts` e documentar que os
   adapters existem apenas em runtime. Nao alterar `FormSpec`,
   `NormalizedFormSpec`, a versao `"1"` ou `schemas/a-form.schema.json`: o schema
   ja define `ui:widget` como widget embutido ou registrado em runtime e aceita
   `ui:options` serializaveis.

## Fase 2: adapters opcionais

1. [x] Criar `packages/presentation-material/` com versoes compativeis de
   `@rjsf/mui`, MUI e Emotion. Converter o tema oficial para
   `PresentationAdapter`, fornecer o provider necessario e verificar que text,
   number, textarea e select usam o label flutuante do `TextField`, enquanto
   checkbox e radio preservam sua estrutura nativa. O core nao deve copiar
   markup Material.
2. [x] Criar `packages/presentation-bootstrap/` usando `@rjsf/react-bootstrap` e
   Bootstrap 5 como peer dependency. Exportar o adapter e documentar o import
   explicito do CSS pelo host. O pacote nao deve injetar CDN ou elementos
   `<link>` em runtime.
3. [x] Criar `packages/presentation-tailwind/` sem introduzir dependencia de
   Tailwind no core. Exportar templates e widgets com classes estaticas e
   documentar que o host deve incluir o pacote no scan de content do Tailwind,
   ou importar o CSS compilado oferecido pelo adapter caso essa saida seja
   adotada. Preservar acessibilidade para label, help, erro, required, disabled
   e foco.
4. [x] Criar `packages/presentation-neobrutalism/` com templates, widgets e CSS
   escopado autocontido, pois Neobrutalism e uma linguagem visual, nao um
   framework com integracao RJSF oficial.
5. [~] Em cada adapter, mapear ao menos `text`, `email`, `number`, `textarea`,
   `select`, `radio` e `checkbox`. Widgets desconhecidos ou registrados pela
   aplicacao devem continuar funcionando, e as opcoes de `uiSchema` devem fluir
   sem traducao especifica por framework.

## Fase 3: playground e migracao visual

1. [x] Em `apps/playground-v2/src/builder/BuilderApp.tsx`, criar um registry estavel
   com os quatro adapters, trocar `PreviewTheme` pelos IDs publicos e passar
   `presentation={{ registry, adapterId }}` ao `AForm`. A selecao continua sendo
   apenas estado do preview e nunca entra no YAML exportado.
2. [ ] Em `apps/playground-v2/src/builder/BuilderApp.css`, remover os blocos
   `.builder-theme-*` que simulam frameworks apenas por cascade e manter somente
   o shell e o frame do builder. Importar na entrada do playground os estilos
   requeridos pelos adapters e garantir que Material e Bootstrap recebam seus
   providers e CSS reais.
3. [x] Atualizar `apps/playground-v2/package.json`, os quatro novos `package.json` e
   `tsconfig.json`, alem das referencias do monorepo conforme o padrao de
   `packages/adapter-fetch`. Dependencias de frameworks devem permanecer fora de
   `a-form-core` e `a-form-react`.

## Fase 4: testes e documentacao

1. [~] Em `packages/react/src/presentation.test.ts`, testar registro, ID duplicado,
   unregister, resolucao ausente e composicao sem mutar o adapter. Em
   `packages/react/src/AForm.test.tsx`, testar fallback sem adapter, preservacao
   de span, ordem e filtragem de campos, delegacao a widget e template custom,
   ausencia de label duplicado e continuidade de pending, error e submit.
2. [ ] Adicionar testes focados em cada pacote de apresentacao. Material deve
   validar label flutuante e estados preenchido, foco, erro e disabled;
   Bootstrap deve validar classes e markup oficiais; Tailwind e Neobrutalism
   devem validar classes, tipos de controle e acessibilidade. Incluir um widget
   custom registrado pelo consumidor para provar extensibilidade.
3. [ ] Adicionar teste de integracao do playground cobrindo a troca dos quatro IDs
   sem alterar a spec gerada. Fazer verificacao visual em mobile, tablet e
   desktop para text, textarea, select, checkbox e radio, incluindo erro
   sincrono, validacao assincrona pendente, disabled e read-only.
4. [~] Atualizar `packages/react/README.md`, os READMEs dos adapters, o README raiz e
   os changelogs. O README raiz, os READMEs dos adapters e
   `docs/presentation-adapters-quick-start.md` ja cobrem quick start, imports de
   CSS, selecao de tema e implementacao de templates e widgets customizados.
   Faltam apenas changelogs individuais e a matriz completa de compatibilidade.
   Registrar que `ui:widget` escolhe a intencao do controle, enquanto o adapter
   escolhe DOM, animacao e aparencia.

## Arquivos relevantes

- `packages/core/src/index.ts`: manter `FormSpec.uiSchema` serializavel e sem
  templates executaveis.
- `schemas/a-form.schema.json`: contrato existente de `uiSchemaNode` e
  `ui:widget`; apenas confirmar por testes, sem mudanca prevista.
- `packages/react/src/AForm.tsx`: composicao dos templates RJSF com layout e
  validacao do AForm.
- `packages/react/src/presentation.ts`: novo contrato e registry.
- `packages/react/src/AForm.test.tsx`: regressao do renderer e integracao dos
  adapters.
- `packages/react/src/index.ts`: exports publicos.
- `packages/react/package.json`: contrato publico sem dependencias dos
  frameworks.
- `packages/presentation-material/`: integracao real MUI e RJSF Material.
- `packages/presentation-bootstrap/`: integracao real RJSF Bootstrap 5.
- `packages/presentation-tailwind/`: templates, widgets e contrato de classes
  Tailwind.
- `packages/presentation-neobrutalism/`: preset autocontido.
- `apps/playground-v2/src/builder/BuilderApp.tsx`: registry e selecao runtime.
- `apps/playground-v2/src/builder/BuilderApp.css`: remocao da simulacao por
  cascade.
- `apps/playground-v2/package.json`: consumo dos quatro adapters.

## Verificacao

1. [~] Executar primeiro os testes focados de `a-form-react`, depois os testes
   dos quatro adapters e do model e playground. Os testes focados do renderer
   passam; ainda faltam testes proprios dos quatro adapters.
2. [x] Executar `npm run typecheck` para validar os genericos RJSF e as
   referencias entre workspaces.
3. [~] Executar `npm test` e `npm run build` no monorepo. O build do playground,
   os adapters e os testes focados passam; falta a bateria completa final.
4. [ ] Iniciar o playground-v2 e validar visualmente os quatro adapters em mobile,
   tablet e desktop. Conferir especialmente o label Material em vazio,
   preenchido, foco e erro, alem de controles boolean e enum, ordem e spans.
5. [ ] Confirmar por snapshot ou serializacao que trocar o adapter nao modifica o
   YAML ou JSON gerado.

## Decisoes

- A spec permanece portatil; tema e framework sao decisoes da aplicacao que
  renderiza.
- Templates sao codigo runtime registrado, nunca conteudo serializado na spec.
- `ui:widget` e o vinculo semantico existente; nao sera criada outra DSL nesta
  fase.
- O registry e extensivel e possui adapter padrao implicito para manter
  retrocompatibilidade.
- Material e Bootstrap usam integracoes reais; Tailwind depende da pipeline CSS
  do host; Neobrutalism e autocontido.
- Estao incluidos os sete tipos de campo atuais, estados comuns, layout,
  validacao e preview.
- Ficam fora deste escopo: editor visual para templates arbitrarios, CSS
  embutido ou exportado na spec, selecao persistida de tema e mudanca para
  `FormSpec` v2.

## Consideracoes para implementacao

1. Antes de fixar dependencias, confirmar a matriz entre React 19.2, RJSF 6.10,
   `@rjsf/mui`, `@rjsf/react-bootstrap` e as versoes de MUI e Bootstrap. Todos os
   pacotes RJSF devem permanecer alinhados na mesma minor.
2. Se o custo de quatro pacotes se mostrar alto, preservar o contrato e publicar
   os adapters por subpath exports em um unico pacote. Eles nao devem ser
   incorporados a `a-form-react`.