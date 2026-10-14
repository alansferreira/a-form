import Form from "@rjsf/core";
import type { FormProps } from "@rjsf/core";
import type { ErrorSchema, RJSFSchema, UiSchema } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import type { JsonObject, JsonValue, NormalizedFormSpec } from "a-form-core";
import { createElement, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FocusEvent, FormEvent, KeyboardEvent, ReactNode } from "react";
import { parseInlineTemplate } from "./inlineTemplate.js";
import type { InlineTemplateDiagnostic, InlineTemplateNode } from "./inlineTemplate.js";
import type { PresentationConfig } from "./presentation.js";
import { useAsyncValidation, valueAtPath } from "./useAsyncValidation.js";
import type { AFormAsyncValidationOptions, AsyncValidationController } from "./useAsyncValidation.js";
import { defaultWidgets, resolveAsyncOptions } from "./widgets.js";

export type AInlineFormCommitMode = "field" | "form";

/** Loads the HTML template from `spec.inline.template` (e.g. a relative path, an id or any other key). */
export type AInlineTemplateLoader = (reference: string) => string | Promise<string>;

type TemplateLoad =
  | { readonly status: "ready"; readonly source: string }
  | { readonly status: "pending"; readonly promise: Promise<string> }
  | { readonly status: "error"; readonly message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface AInlineFormCommitEvent {
  readonly path: string;
  readonly value: JsonValue | undefined;
  readonly formData: JsonObject;
}

export interface AInlineFormLabels {
  readonly confirm?: string;
  readonly cancel?: string;
  readonly empty?: string;
  readonly yes?: string;
  readonly no?: string;
  readonly submit?: string;
  readonly pending?: string;
}

export interface AInlineFormProps {
  readonly spec: NormalizedFormSpec;
  /**
   * HTML template overriding `spec.inline.template`, or a loader that receives `spec.inline.template` and returns
   * the HTML (sync or async). The loader runs again only when `spec.inline.template` changes.
   */
  readonly template?: string | AInlineTemplateLoader;
  readonly value?: JsonObject;
  /** "field" commits each confirmed field (after sync + async validation); "form" commits on submit. */
  readonly commitMode?: AInlineFormCommitMode;
  readonly confirmOnBlur?: boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly className?: string;
  readonly locale?: string;
  readonly labels?: AInlineFormLabels;
  readonly presentation?: PresentationConfig;
  readonly asyncValidation?: AFormAsyncValidationOptions;
  readonly onChange?: (value: JsonObject) => void;
  readonly onCommit?: (event: AInlineFormCommitEvent) => void;
  readonly onSubmit?: (value: JsonObject, event: FormEvent<HTMLFormElement>) => void;
  /** Template problems (unknown paths, removed tags/attributes); logged with console.warn when omitted. */
  readonly onDiagnostic?: (diagnostics: readonly InlineTemplateDiagnostic[]) => void;
}

const DEFAULT_LABELS: Required<AInlineFormLabels> = {
  confirm: "Save",
  cancel: "Cancel",
  empty: "Click to edit",
  yes: "Yes",
  no: "No",
  submit: "Submit",
  pending: "Validating...",
};

type SchemaNode = Record<string, unknown>;

function asRecord(value: unknown): SchemaNode | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as SchemaNode : undefined;
}

function schemaAtPath(schema: unknown, path: string): SchemaNode | undefined {
  let current = asRecord(schema);
  for (const segment of path.split(".")) {
    current = asRecord(asRecord(current?.properties)?.[segment]);
    if (!current) return undefined;
  }
  return current;
}

function uiSchemaAtPath(uiSchema: unknown, path: string): SchemaNode | undefined {
  let current = asRecord(uiSchema);
  for (const segment of path.split(".")) {
    current = asRecord(current?.[segment]);
    if (!current) return undefined;
  }
  return current;
}

function setValueAtPath(value: JsonObject, path: string, next: JsonValue | undefined): JsonObject {
  const [head, ...rest] = path.split(".");
  if (head === undefined) return value;
  const copy: Record<string, JsonValue> = { ...value };
  if (rest.length === 0) {
    if (next === undefined) delete copy[head];
    else copy[head] = next;
    return copy;
  }
  const child = asRecord(copy[head]) as JsonObject | undefined;
  copy[head] = setValueAtPath(child ?? {}, rest.join("."), next);
  return copy;
}

function errorsAtPath(errorSchema: ErrorSchema, path: string): readonly string[] {
  let current: unknown = errorSchema;
  for (const segment of path.split(".")) current = asRecord(current)?.[segment];
  const errors = asRecord(current)?.__errors;
  return Array.isArray(errors) ? errors.filter((message): message is string => typeof message === "string") : [];
}

function collectErrors(errorSchema: unknown, prefix = ""): { path: string; message: string }[] {
  const record = asRecord(errorSchema);
  if (!record) return [];
  return Object.entries(record).flatMap(([key, child]) => key === "__errors"
    ? (Array.isArray(child) ? child.map((message) => ({ path: prefix, message: String(message) })) : [])
    : collectErrors(child, prefix ? `${prefix}.${key}` : key));
}

function optionKey(value: JsonValue | undefined): string {
  return JSON.stringify(value ?? null);
}

function formatValue(
  value: JsonValue | undefined,
  schema: SchemaNode,
  uiSchema: SchemaNode | undefined,
  labels: Required<AInlineFormLabels>,
  locale: string | undefined,
  optionLabel: string | undefined,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (optionLabel !== undefined) return optionLabel;
  const options = asRecord(uiSchema?.["ui:options"]) ?? {};
  if (Array.isArray(schema.enum)) {
    const index = schema.enum.findIndex((candidate) => candidate === value);
    const names = uiSchema?.["ui:enumNames"] ?? options.enumNames;
    if (index >= 0 && Array.isArray(names) && typeof names[index] === "string") return names[index];
  }
  for (const key of ["oneOf", "anyOf"]) {
    const entries = schema[key];
    if (!Array.isArray(entries)) continue;
    const match = entries.map(asRecord).find((entry) => entry?.const === value);
    if (typeof match?.title === "string") return match.title;
  }
  if (typeof value === "boolean") return value ? labels.yes : labels.no;
  const widget = uiSchema?.["ui:widget"];
  if (typeof value === "string" && (widget === "date" || schema.format === "date")) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (parts) return new Intl.DateTimeFormat(locale).format(new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])));
  }
  if (typeof value === "string" && (widget === "datetime" || schema.format === "date-time")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

interface InlineFieldContext {
  readonly schema: JsonObject;
  readonly uiSchema: JsonObject | undefined;
  readonly value: JsonObject;
  readonly commitMode: AInlineFormCommitMode;
  readonly confirmOnBlur: boolean;
  readonly interactive: boolean;
  readonly labels: Required<AInlineFormLabels>;
  readonly locale: string | undefined;
  readonly formProps: Partial<Pick<FormProps, "widgets" | "templates" | "fields">>;
  readonly asyncValidation: AsyncValidationController;
  readonly submitErrors: ErrorSchema;
  readonly optionLabels: Map<string, string>;
  placeholderPath(expression: string): string | undefined;
  commit(path: string, next: JsonValue | undefined): Promise<boolean>;
}

function InlineField({ path, context }: { readonly path: string; readonly context: InlineFieldContext }) {
  const idPrefix = `a-form-inline-${useId().replace(/[^\w-]/g, "")}`;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<JsonValue | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const formRef = useRef<Form>(null);
  const readRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  useEffect(() => {
    if (wasEditing.current && !editing) readRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const segments = path.split(".");
  const leaf = segments[segments.length - 1] ?? path;
  const fieldSchema = schemaAtPath(context.schema, path) ?? {};
  const parentSchema = segments.length > 1 ? schemaAtPath(context.schema, segments.slice(0, -1).join(".")) : context.schema;
  const required = Array.isArray(parentSchema?.required) && parentSchema.required.includes(leaf);
  const fieldUi = uiSchemaAtPath(context.uiSchema, path);
  const label = typeof fieldUi?.["ui:title"] === "string"
    ? fieldUi["ui:title"]
    : typeof fieldSchema.title === "string" ? fieldSchema.title : leaf;
  const current = valueAtPath(context.value, path);
  const { asyncFields, extraErrors } = context.asyncValidation;
  const asyncState = asyncFields[path];
  const blockingMessages = errorsAtPath(extraErrors, path);
  const submitMessages = errorsAtPath(context.submitErrors, path);

  const uiOptions = asRecord(fieldUi?.["ui:options"]);
  const staticSource = uiOptions?.source;
  const staticOption = Array.isArray(staticSource)
    ? resolveAsyncOptions(staticSource, {
        ...(typeof uiOptions?.valueKey === "string" ? { valueKey: uiOptions.valueKey } : {}),
        ...(typeof uiOptions?.labelKey === "string" ? { labelKey: uiOptions.labelKey } : {}),
        ...(typeof uiOptions?.itemTemplate === "string" ? { itemTemplate: uiOptions.itemTemplate } : {}),
      }).find((option) => optionKey(option.value) === optionKey(current))
    : undefined;
  const optionLabel = staticOption?.label ?? context.optionLabels.get(`${path}:${optionKey(current)}`);
  const display = formatValue(current, fieldSchema, fieldUi, context.labels, context.locale, optionLabel);

  const start = () => {
    setDraft(current);
    setEditing(true);
  };

  const cancel = () => {
    if (context.commitMode === "field") context.asyncValidation.clearField(path);
    setEditing(false);
  };

  const confirm = async () => {
    if (confirmingRef.current) return;
    if (formRef.current && !formRef.current.validateForm()) return;
    confirmingRef.current = true;
    setConfirming(true);
    try {
      if (await context.commit(path, draft)) setEditing(false);
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    } else if (event.key === "Enter" && !event.shiftKey && !(event.target instanceof HTMLTextAreaElement)) {
      // Also stops implicit submission of the surrounding <form> in "form" mode.
      event.preventDefault();
      void confirm();
    }
  };

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!context.confirmOnBlur) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    void confirm();
  };

  const draftData = setValueAtPath(context.value, path, draft);
  const miniSchema = {
    type: "object",
    properties: { [leaf]: fieldSchema },
    ...(required ? { required: [leaf] } : {}),
    ...("definitions" in context.schema ? { definitions: context.schema.definitions } : {}),
    ...("$defs" in context.schema ? { $defs: context.schema.$defs } : {}),
  } as RJSFSchema;
  const miniUiSchema = {
    "ui:submitButtonOptions": { norender: true },
    [leaf]: { ...fieldUi, "ui:autofocus": true, "ui:options": { ...uiOptions, label: false } },
  } as UiSchema;

  const state = editing
    ? "edit"
    : asyncState?.status === "pending" ? "pending"
      : blockingMessages.length > 0 || submitMessages.length > 0 ? "invalid" : "read";
  const issues = [
    ...(asyncState?.issues ?? [])
      .filter((issue) => !editing || issue.severity !== "error" || !asyncState?.blocking)
      .map(({ message, severity }) => ({ message, severity })),
    ...(editing ? [] : submitMessages.map((message) => ({ message, severity: "error" as const }))),
  ];

  return (
    <span className="a-form-inline-field" data-a-form-inline-field={path} data-state={state}>
      {editing ? (
        <span className="a-form-inline-edit" role="group" aria-label={label} onBlur={onBlur} onKeyDown={onKeyDown}>
          <Form
            ref={formRef}
            tagName="span"
            schema={miniSchema}
            uiSchema={miniUiSchema}
            validator={validator}
            formData={draft === undefined ? {} : { [leaf]: draft }}
            formContext={{
              rootFormData: draftData,
              rememberOptionLabel: (value: JsonValue, optionText: string) => {
                context.optionLabels.set(`${path}:${optionKey(value)}`, optionText);
              },
            }}
            idPrefix={idPrefix}
            idSeparator="."
            noHtml5Validate
            showErrorList={false}
            onError={() => {}}
            extraErrors={blockingMessages.length > 0 ? { [leaf]: { __errors: [...blockingMessages] } } as ErrorSchema : {}}
            {...context.formProps}
            onChange={({ formData }) => {
              const next = (formData as JsonObject | undefined)?.[leaf];
              setDraft(next);
              context.asyncValidation.handleChange(draftData, setValueAtPath(context.value, path, next));
            }}
          />
          <span className="a-form-inline-actions">
            <button
              className="a-form-inline-confirm"
              disabled={confirming}
              type="button"
              onClick={() => void confirm()}
              onMouseDown={(event) => event.preventDefault()}
            >
              {context.labels.confirm}
            </button>
            <button
              className="a-form-inline-cancel"
              type="button"
              onClick={cancel}
              onMouseDown={(event) => event.preventDefault()}
            >
              {context.labels.cancel}
            </button>
          </span>
        </span>
      ) : context.interactive ? (
        <button
          ref={readRef}
          aria-label={`${label}: ${display ?? context.labels.empty}`}
          className={`a-form-inline-read${display === undefined ? " a-form-inline-read-empty" : ""}`}
          type="button"
          onClick={start}
        >
          {display ?? context.labels.empty}
        </button>
      ) : (
        <span className={`a-form-inline-read${display === undefined ? " a-form-inline-read-empty" : ""}`}>
          {display ?? ""}
        </span>
      )}
      {asyncState?.status === "pending" && (
        <span className="a-form-inline-status" role="status">{context.labels.pending}</span>
      )}
      {issues.map(({ message, severity }) => (
        <span
          className={`a-form-inline-issue a-form-inline-issue-${severity}`}
          key={`${severity}:${message}`}
          role={severity === "error" ? "alert" : "status"}
        >
          {message}
        </span>
      ))}
    </span>
  );
}

function renderNodes(nodes: readonly InlineTemplateNode[], context: InlineFieldContext, keyPrefix = ""): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}${index}`;
    if (node.kind === "text") return node.value;
    if (node.kind === "placeholder") {
      const path = context.placeholderPath(node.expression);
      return path === undefined ? node.raw : <InlineField context={context} key={key} path={path} />;
    }
    return createElement(
      node.tag,
      { ...node.attributes, key },
      ...(node.children.length > 0 ? renderNodes(node.children, context, `${key}.`) : []),
    );
  });
}

export function AInlineForm({
  spec,
  template,
  value,
  commitMode = "field",
  confirmOnBlur = true,
  disabled,
  readOnly,
  className,
  locale,
  labels,
  presentation,
  asyncValidation,
  onChange,
  onCommit,
  onSubmit,
  onDiagnostic,
}: AInlineFormProps) {
  const reference = spec.inline?.template;
  const loader = typeof template === "function" ? template : undefined;
  if (reference === undefined && typeof template !== "string") {
    throw new Error("AInlineForm requires a template (an HTML `template` prop or `spec.inline.template`).");
  }
  const presentationAdapter = presentation?.registry.get(presentation.adapterId);
  if (presentation && !presentationAdapter) {
    throw new Error(`Presentation adapter '${presentation.adapterId}' is not registered.`);
  }
  const {
    SeparatorTemplate: _separatorTemplate,
    ButtonTemplates: adapterButtonTemplates,
    ...adapterTemplates
  } = presentationAdapter?.templates ?? {};
  void _separatorTemplate;

  const [internalValue, setInternalValue] = useState<JsonObject>(value ?? {});
  const [submitErrors, setSubmitErrors] = useState<ErrorSchema>({});
  const optionLabels = useRef(new Map<string, string>()).current;
  const currentValue = value ?? internalValue;
  const asyncController = useAsyncValidation(spec.validations?.async ?? [], asyncValidation);
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };

  const syncLoad = useMemo((): TemplateLoad => {
    if (typeof template === "string") return { status: "ready", source: template };
    if (!loader) return { status: "ready", source: reference ?? "" };
    try {
      const output = loader(reference ?? "");
      return typeof output === "string" ? { status: "ready", source: output } : { status: "pending", promise: output };
    } catch (error) {
      return { status: "error", message: errorMessage(error) };
    }
    // A new loader identity on every render must not reload the template.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeof template === "string" ? template : undefined, Boolean(loader), reference]);

  const [asyncLoad, setAsyncLoad] = useState<{ readonly request: TemplateLoad; readonly result: TemplateLoad }>();

  useEffect(() => {
    if (syncLoad.status !== "pending") return;
    let active = true;
    Promise.resolve(syncLoad.promise)
      .then(
        (source): TemplateLoad => ({ status: "ready", source: String(source) }),
        (error: unknown): TemplateLoad => ({ status: "error", message: errorMessage(error) }),
      )
      .then((result) => {
        if (active) setAsyncLoad({ request: syncLoad, result });
      });
    return () => {
      active = false;
    };
  }, [syncLoad]);

  const load = syncLoad.status === "pending" && asyncLoad?.request === syncLoad ? asyncLoad.result : syncLoad;
  const source = load.status === "ready" ? load.source : "";
  const parsed = useMemo(() => parseInlineTemplate(source), [source]);

  const isScalarField = (path: string) => {
    const fieldSchema = schemaAtPath(spec.schema, path);
    return fieldSchema !== undefined && fieldSchema.type !== "object" && fieldSchema.type !== "array";
  };
  const fieldPaths = parsed.expressions.filter(isScalarField);
  const diagnostics: InlineTemplateDiagnostic[] = [
    ...(load.status === "error" ? [{ code: "YF_INLINE_TEMPLATE_LOAD", message: `Inline template could not be loaded: ${load.message}` }] : []),
    ...parsed.diagnostics,
    ...parsed.expressions
      .filter((expression) => !isScalarField(expression))
      .map((expression) => ({ code: "YF_INLINE_PATH", message: `Inline placeholder '{{${expression}}}' does not match a scalar schema field.` })),
  ];
  const diagnosticsKey = diagnostics.map(({ code, message }) => `${code}:${message}`).join("\n");

  useEffect(() => {
    if (diagnostics.length === 0) return;
    if (onDiagnostic) onDiagnostic(diagnostics);
    else diagnostics.forEach(({ code, message }) => console.warn(`[AInlineForm] ${code}: ${message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosticsKey]);

  const applyValue = (next: JsonObject) => {
    setInternalValue(next);
    onChange?.(next);
  };

  const context: InlineFieldContext = {
    schema: spec.schema,
    uiSchema: spec.uiSchema,
    value: currentValue,
    commitMode,
    confirmOnBlur,
    interactive: !disabled && !readOnly,
    labels: mergedLabels,
    locale,
    formProps: {
      widgets: { ...defaultWidgets, ...presentationAdapter?.widgets },
      templates: {
        ...adapterTemplates,
        ...(adapterButtonTemplates ? { ButtonTemplates: adapterButtonTemplates } : {}),
      },
      ...(presentationAdapter?.fields ? { fields: presentationAdapter.fields } : {}),
    },
    asyncValidation: asyncController,
    submitErrors,
    optionLabels,
    placeholderPath: (expression) => isScalarField(expression) ? expression : undefined,
    async commit(path, next) {
      const merged = setValueAtPath(currentValue, path, next);
      if (commitMode === "field") {
        const results = await asyncController.runField(path, ["blur", "submit", "change"], merged);
        if (results.some((result) => result.blocking)) return false;
        applyValue(merged);
        onCommit?.({ path, value: next, formData: merged });
        return true;
      }
      setSubmitErrors((errors) => setValueAtPath(errors as JsonObject, path, undefined) as ErrorSchema);
      applyValue(merged);
      void asyncController.runField(path, ["blur"], merged);
      return true;
    },
  };

  const rootClassName = ["a-form-inline", className, presentationAdapter?.className].filter(Boolean).join(" ");

  if (load.status !== "ready") {
    return (
      <div
        aria-busy={load.status === "pending" ? true : undefined}
        className={`${rootClassName} a-form-inline-${load.status === "pending" ? "loading" : "load-error"}`}
      />
    );
  }

  const content = renderNodes(parsed.nodes, context);

  if (commitMode === "field") {
    return <div className={rootClassName}>{content}</div>;
  }

  const unplacedErrors = collectErrors(submitErrors).filter(({ path }) => !fieldPaths.includes(path));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { errorSchema } = validator.validateFormData(
      currentValue,
      spec.schema as RJSFSchema,
      undefined,
      undefined,
      (spec.uiSchema ?? {}) as UiSchema,
    );
    setSubmitErrors(errorSchema);
    if (collectErrors(errorSchema).length > 0) return;
    if (await asyncController.runSubmit(currentValue)) return;
    onSubmit?.(currentValue, event);
  };

  return (
    <form className={rootClassName} noValidate onSubmit={(event) => void handleSubmit(event)}>
      {content}
      {unplacedErrors.length > 0 && (
        <ul className="a-form-inline-errors" role="alert">
          {unplacedErrors.map(({ path, message }) => <li key={`${path}:${message}`}>{path ? `${path}: ${message}` : message}</li>)}
        </ul>
      )}
      <button className="a-form-submit a-form-inline-submit" disabled={asyncController.isPending || disabled} type="submit">
        {mergedLabels.submit}
      </button>
    </form>
  );
}
