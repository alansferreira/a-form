import Form from "@rjsf/core";
import type {
  FieldTemplateProps,
  ObjectFieldTemplateProps,
  RJSFSchema,
  UiSchema,
} from "@rjsf/utils";
import {
  buttonId,
  canExpand,
  descriptionId,
  getTemplate,
  getUiOptions,
  titleId,
} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import type {
  ColumnAlign,
  JsonObject,
  NormalizedFieldNode,
  NormalizedFormSpec,
  NormalizedSeparatorNode,
} from "a-form-core";
import { renderTemplate } from "a-form-template";
import type { PresentationConfig, SeparatorTemplateProps } from "./presentation.js";
import { useAsyncValidation } from "./useAsyncValidation.js";
import type { AFormAsyncValidationOptions, AsyncFieldState } from "./useAsyncValidation.js";
import { defaultWidgets } from "./widgets.js";
import { useEffect, useRef, useState } from "react";
import type { ComponentType, CSSProperties, FormEvent, ReactNode } from "react";

export type AFormViewport = "auto" | "mobile" | "tablet" | "desktop";
type ResolvedViewport = Exclude<AFormViewport, "auto">;

export interface AFormProps {
  readonly spec: NormalizedFormSpec;
  readonly viewport?: AFormViewport;
  readonly value?: JsonObject;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly noHtml5Validate?: boolean;
  readonly className?: string;
  readonly submitLabel?: ReactNode;
  readonly presentation?: PresentationConfig;
  readonly asyncValidation?: AFormAsyncValidationOptions;
  readonly onChange?: (value: JsonObject) => void;
  readonly onSubmit?: (value: JsonObject, event: FormEvent<HTMLFormElement>) => void;
}

interface LayoutFormContext {
  readonly fieldSpans: Readonly<Record<string, number>>;
  readonly fieldAlign: Readonly<Record<string, ColumnAlign>>;
  readonly order: Readonly<Record<string, number>>;
  readonly layoutPaths: readonly string[];
  readonly asyncFields: Readonly<Record<string, AsyncFieldState>>;
  readonly presentationFieldTemplate?: ComponentType<FieldTemplateProps>;
  readonly separators: readonly SeparatorPlacement[];
  readonly presentationSeparatorTemplate?: ComponentType<SeparatorTemplateProps>;
  readonly rootFormData: JsonObject;
}

interface SeparatorPlacement extends NormalizedSeparatorNode {
  readonly order: number;
}

function separatorTitleId(separatorId: string): string {
  return `a-form-separator-title-${separatorId}`;
}

function fieldPathFromId(id: string): string | undefined {
  return id.startsWith("root.") ? id.slice(5) : undefined;
}

interface CollectedLayout {
  readonly fieldSpans: Record<string, number>;
  readonly fieldAlign: Record<string, ColumnAlign>;
  readonly order: Record<string, number>;
  readonly separators: SeparatorPlacement[];
}

function spanForViewport(field: NormalizedFieldNode, viewport: ResolvedViewport): number {
  return field.span[viewport];
}

/** Assigns each field and separator its serialized flow order; CSS grid handles responsive wrapping. */
function collectFormLayout(layout: NormalizedFormSpec["layout"], viewport: ResolvedViewport): CollectedLayout {
  const fieldSpans: Record<string, number> = {};
  const fieldAlign: Record<string, ColumnAlign> = {};
  const order: Record<string, number> = {};
  const separators: SeparatorPlacement[] = [];
  let nextOrder = 0;

  for (const node of layout) {
    if (node.type === "separator") {
      separators.push({ ...node, order: nextOrder++ });
      continue;
    }
    fieldSpans[node.path] = spanForViewport(node, viewport);
    fieldAlign[node.path] = node.align;
    order[node.path] = nextOrder++;
  }

  return { fieldSpans, fieldAlign, order, separators };
}

function relationToLayout(path: string, context: LayoutFormContext) {
  return {
    exact: context.layoutPaths.includes(path),
    ancestor: path === "" || context.layoutPaths.some((layoutPath) => layoutPath.startsWith(`${path}.`)),
    descendant: context.layoutPaths.some((layoutPath) => path.startsWith(`${layoutPath}.`)),
  };
}

function createFieldTemplate() {
  return function FieldTemplate(props: FieldTemplateProps) {
    const path = props.fieldPathId.path.join(".");
    const context = props.registry.formContext as LayoutFormContext;
    const relation = relationToLayout(path, context);
    const asyncState = context.asyncFields[path];
    const AdapterFieldTemplate = context.presentationFieldTemplate;
    const helpTemplate = (props.uiSchema as Record<string, unknown> | undefined)?.["ui:helpTemplate"];
    const templatedProps = typeof helpTemplate === "string"
      ? { ...props, help: <>{renderTemplate(helpTemplate, context.rootFormData)}</> }
      : props;

    if (props.hidden) return <div className="a-form-hidden-field" hidden>{props.children}</div>;
    if (!relation.exact && !relation.ancestor && !relation.descendant) return null;
    if (relation.ancestor && !relation.exact) return <>{props.children}</>;

    const style = relation.exact
      ? {
          ...props.style,
          // "start" fields pack left-to-right; "end" fields hug the grid's right edge (line -1) so the browser's
          // native auto-placement decides on its own when a field fits the current row or must wrap to the next one.
          gridColumn: context.fieldAlign[path] === "end"
            ? `span ${context.fieldSpans[path]} / -1`
            : `span ${context.fieldSpans[path]}`,
          order: context.order[path],
        } as CSSProperties
      : props.style;

    return (
      <div
        className={`a-form-field ${relation.exact ? "a-form-layout-field" : "a-form-nested-field"} ${props.classNames ?? ""}`}
        data-a-form-field={relation.exact ? path : undefined}
        style={style}
      >
        {AdapterFieldTemplate ? <AdapterFieldTemplate {...templatedProps} /> : renderDefaultFieldContents(templatedProps)}
        {asyncState?.status === "pending" && (
          <span className="a-form-async-status" role="status">Validating...</span>
        )}
        {asyncState?.issues.filter(() => !asyncState.blocking).map((issue) => (
          <span
            className={`a-form-async-issue a-form-async-issue-${issue.severity}`}
            key={`${issue.code}:${issue.message}`}
            role={issue.severity === "error" ? "alert" : "status"}
          >
            {issue.message}
          </span>
        ))}
      </div>
    );
  };
}

function renderDefaultFieldContents(props: FieldTemplateProps): ReactNode {
  const options = getUiOptions(props.uiSchema);
  const WrapIfAdditionalTemplate = getTemplate("WrapIfAdditionalTemplate", props.registry, options);
  const isCheckbox = options.widget === "checkbox" || props.schema.type === "boolean";

  return (
    <WrapIfAdditionalTemplate {...props}>
      {props.displayLabel && !isCheckbox && (
        <label className="a-form-label" htmlFor={props.id}>
          {props.label}
          {props.required ? <span className="a-form-required"> *</span> : null}
        </label>
      )}
      {props.displayLabel ? props.description : null}
      {props.children}
      {!props.hideError && props.errors}
      {props.help}
    </WrapIfAdditionalTemplate>
  );
}

function DefaultSeparatorTemplate({ id, title, description }: SeparatorTemplateProps): ReactNode {
  return (
    <div className="a-form-separator" role="separator" aria-orientation="horizontal" aria-label={title}>
      <span className="a-form-separator-line" aria-hidden="true" />
      <span className="a-form-separator-content">
        <span className="a-form-separator-title" id={separatorTitleId(id)}>{title}</span>
        {description && <span className="a-form-separator-description">{description}</span>}
      </span>
      <span className="a-form-separator-line" aria-hidden="true" />
    </div>
  );
}

function createObjectFieldTemplate() {
  return function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
    const path = props.fieldPathId.path.join(".");
    const context = props.registry.formContext as LayoutFormContext;
    const relation = relationToLayout(path, context);
    const options = getUiOptions(props.uiSchema);
    const TitleFieldTemplate = getTemplate("TitleFieldTemplate", props.registry, options);
    const DescriptionFieldTemplate = getTemplate("DescriptionFieldTemplate", props.registry, options);
    const { AddButton } = props.registry.templates.ButtonTemplates;
    const showMetadata = path !== "" && !(relation.ancestor && !relation.exact);
    const style = path === ""
      ? { display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: "1rem" }
      : relation.ancestor && !relation.exact ? { display: "contents" } : undefined;

    return (
      <div
        className={`a-form-object ${path === "" ? "a-form-object-root" : relation.ancestor && !relation.exact ? "a-form-object-bridge" : "a-form-object-nested"}`}
        data-a-form-object={path}
        style={style}
      >
        {showMetadata && props.title && (
          <TitleFieldTemplate
            id={titleId(props.fieldPathId)}
            title={props.title}
            required={props.required ?? false}
            schema={props.schema}
            uiSchema={props.uiSchema ?? {}}
            registry={props.registry}
            optionalDataControl={!props.readonly && !props.disabled ? props.optionalDataControl : undefined}
          />
        )}
        {showMetadata && props.description && (
          <DescriptionFieldTemplate
            id={descriptionId(props.fieldPathId)}
            description={props.description}
            schema={props.schema}
            uiSchema={props.uiSchema ?? {}}
            registry={props.registry}
          />
        )}
        {(props.readonly || props.disabled || !showMetadata) && props.optionalDataControl}
        {path === "" && context.separators.map((separator) => {
          const SeparatorComponent = context.presentationSeparatorTemplate ?? DefaultSeparatorTemplate;
          return (
            <div
              key={separator.id}
              className="a-form-separator-item"
              style={{ gridColumn: "1 / 13", order: separator.order }}
            >
              <SeparatorComponent
                id={separator.id}
                title={separator.title}
                {...(separator.description !== undefined ? { description: separator.description } : {})}
              />
            </div>
          );
        })}
        {props.properties.map(({ content, name }) => <div className="a-form-property" key={name} style={{ display: "contents" }}>{content}</div>)}
        {canExpand(props.schema, props.uiSchema, props.formData) && (
          <AddButton
            id={buttonId(props.fieldPathId, "add")}
            onClick={props.onAddProperty}
            disabled={Boolean(props.disabled || props.readonly)}
            uiSchema={props.uiSchema ?? {}}
            registry={props.registry}
          />
        )}
      </div>
    );
  };
}

const FieldTemplate = createFieldTemplate();
const ObjectFieldTemplate = createObjectFieldTemplate();

export function AForm({
  spec,
  viewport = "desktop",
  value,
  disabled,
  readOnly,
  noHtml5Validate,
  className,
  submitLabel = "Submit",
  presentation,
  asyncValidation,
  onChange,
  onSubmit,
}: AFormProps) {
  const formRef = useRef<Form>(null);
  const [autoViewport, setAutoViewport] = useState<ResolvedViewport>("mobile");
  useEffect(() => {
    if (viewport !== "auto") return;
    const element: unknown = formRef.current?.formElement.current;
    if (!(element instanceof HTMLElement)) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = entry.contentRect.width;
      setAutoViewport(width >= 1024 ? "desktop" : width >= 768 ? "tablet" : "mobile");
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewport]);

  const presentationAdapter = presentation?.registry.get(presentation.adapterId);
  if (presentation && !presentationAdapter) {
    throw new Error(`Presentation adapter '${presentation.adapterId}' is not registered.`);
  }
  const {
    ButtonTemplates: adapterButtonTemplates,
    SeparatorTemplate: adapterSeparatorTemplate,
    ...adapterTemplates
  } = presentationAdapter?.templates ?? {};
  const latestValue = useRef<JsonObject>(value ?? {});
  latestValue.current = value ?? latestValue.current;
  const { asyncFields, extraErrors, isPending, handleChange, runField, runSubmit } = useAsyncValidation(
    spec.validations?.async ?? [],
    asyncValidation,
  );

  const { fieldSpans, fieldAlign, order, separators } = collectFormLayout(
    spec.layout,
    viewport === "auto" ? autoViewport : viewport,
  );
  const formContext: LayoutFormContext = {
    fieldSpans,
    fieldAlign,
    order,
    layoutPaths: Object.keys(fieldSpans),
    asyncFields,
    separators,
    rootFormData: value ?? {},
    ...(presentationAdapter?.templates?.FieldTemplate
      ? { presentationFieldTemplate: presentationAdapter.templates.FieldTemplate }
      : {}),
    ...(adapterSeparatorTemplate
      ? { presentationSeparatorTemplate: adapterSeparatorTemplate }
      : {}),
  };
  const SubmitButton = () => (
    <button className="a-form-submit" disabled={isPending} type="submit">
      {submitLabel}
    </button>
  );

  return (
    <Form
      ref={formRef}
      className={[className, presentationAdapter?.className].filter(Boolean).join(" ")}
      schema={spec.schema as RJSFSchema}
      uiSchema={(spec.uiSchema ?? {}) as UiSchema}
      validator={validator}
      formContext={formContext}
      formData={value ?? {}}
      idSeparator="."
      disabled={disabled ?? false}
      readonly={readOnly ?? false}
      noHtml5Validate={noHtml5Validate ?? false}
      extraErrors={extraErrors}
      onBlur={(id) => {
        const fieldPath = fieldPathFromId(id);
        if (!fieldPath) return;
        void runField(fieldPath, ["blur"], latestValue.current);
      }}
      onChange={({ formData }) => {
        const nextValue = (formData ?? {}) as JsonObject;
        const previousValue = latestValue.current;
        latestValue.current = nextValue;
        onChange?.(nextValue);
        handleChange(previousValue, nextValue);
      }}
      onSubmit={async ({ formData }, event) => {
        const submittedValue = (formData ?? {}) as JsonObject;
        latestValue.current = submittedValue;
        if (await runSubmit(submittedValue)) return;
        onSubmit?.(submittedValue, event);
      }}
      {...(presentationAdapter?.fields ? { fields: presentationAdapter.fields } : {})}
      widgets={{ ...defaultWidgets, ...presentationAdapter?.widgets }}
      templates={{
        ...adapterTemplates,
        FieldTemplate,
        ObjectFieldTemplate,
        ButtonTemplates: { ...adapterButtonTemplates, SubmitButton },
      }}
      showErrorList={false}
    />
  );
}