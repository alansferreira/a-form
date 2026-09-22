import Form from "@rjsf/core";
import type {
  ErrorSchema,
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
  AsyncValidationEngine,
  AsyncValidationIssue,
  AsyncValidationResult,
  AsyncValidationStatus,
} from "a-form-async-validation";
import type {
  AsyncValidationRuleSpec,
  AsyncValidationTrigger,
  JsonObject,
  JsonValue,
  NormalizedFormSpec,
  NormalizedRowNode,
} from "a-form-core";
import type { PresentationConfig } from "./presentation.js";
import { useEffect, useRef, useState } from "react";
import type { ComponentType, CSSProperties, FormEvent, ReactNode } from "react";

export type AFormViewport = "mobile" | "tablet" | "desktop";

export interface AFormAsyncValidationEvent {
  readonly ruleId: string;
  readonly fieldPath: string;
  readonly trigger: AsyncValidationTrigger;
  readonly result: AsyncValidationResult;
}

export interface AFormAsyncValidationOptions {
  readonly engine: AsyncValidationEngine;
  readonly onResult?: (event: AFormAsyncValidationEvent) => void;
}

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
  readonly placements: Readonly<Record<string, GridPlacement>>;
  readonly order: Readonly<Record<string, number>>;
  readonly layoutPaths: readonly string[];
  readonly asyncFields: Readonly<Record<string, AsyncFieldState>>;
  readonly presentationFieldTemplate?: ComponentType<FieldTemplateProps>;
}

interface AsyncFieldState {
  readonly status: AsyncValidationStatus;
  readonly issues: readonly AsyncValidationIssue[];
  readonly blocking: boolean;
}

interface ValidationRecord {
  readonly fieldPath: string;
  readonly result: AsyncValidationResult;
}

function valueAtPath(value: JsonValue, path: string): JsonValue | undefined {
  let current: JsonValue | undefined = value;
  for (const segment of path.split(".")) {
    if (current === null || Array.isArray(current) || typeof current !== "object") return undefined;
    current = current[segment];
  }
  return current;
}

function fieldPathFromId(id: string): string | undefined {
  return id.startsWith("root.") ? id.slice(5) : undefined;
}

function appliesToTrigger(rule: AsyncValidationRuleSpec, trigger: AsyncValidationTrigger): boolean {
  return (rule.triggers ?? ["blur", "submit"]).includes(trigger);
}

function addError(errorSchema: ErrorSchema, path: string, message: string): void {
  let current = errorSchema;
  for (const segment of path.split(".")) {
    current[segment] ??= {};
    current = current[segment] as ErrorSchema;
  }
  current.__errors = [...(current.__errors ?? []), message];
}

interface GridPlacement {
  readonly start: number;
  readonly end: number;
  readonly row: number;
}

function collectLayout(
  rows: readonly NormalizedRowNode[],
  viewport: AFormViewport,
  placements: Record<string, GridPlacement>,
  order: Record<string, number>,
  rowCursor: { current: number } = { current: 1 },
): void {
  for (const row of rows) {
    // Pin every field in this row to the same explicit grid line so a right-aligned
    // column's leftover gap can't be filled by the next row's fields (auto-placement bleed).
    const gridRow = rowCursor.current++;
    // "start"-aligned columns pack from grid line 1 rightward; "end"-aligned columns pack from line 13 leftward.
    let startCursor = 1;
    let endCursor = 13;
    for (const column of row.children) {
      const span = column.span[viewport];
      const placement: GridPlacement = column.align === "end"
        ? { start: endCursor - span, end: endCursor, row: gridRow }
        : { start: startCursor, end: startCursor + span, row: gridRow };
      if (column.align === "end") endCursor -= span;
      else startCursor += span;

      for (const child of column.children) {
        if (child.type === "field") {
          placements[child.path] = placement;
          order[child.path] = Object.keys(order).length;
        } else {
          collectLayout([child], viewport, placements, order, rowCursor);
        }
      }
    }
  }
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

    if (props.hidden) return <div className="a-form-hidden-field" hidden>{props.children}</div>;
    if (!relation.exact && !relation.ancestor && !relation.descendant) return null;
    if (relation.ancestor && !relation.exact) return <>{props.children}</>;

    const style = relation.exact
      ? {
          ...props.style,
          gridColumn: `${context.placements[path]?.start} / ${context.placements[path]?.end}`,
          gridRow: context.placements[path]?.row,
          order: context.order[path],
        } as CSSProperties
      : props.style;

    return (
      <div
        className={`a-form-field ${relation.exact ? "a-form-layout-field" : "a-form-nested-field"} ${props.classNames ?? ""}`}
        data-a-form-field={relation.exact ? path : undefined}
        style={style}
      >
        {AdapterFieldTemplate ? <AdapterFieldTemplate {...props} /> : renderDefaultFieldContents(props)}
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

function createObjectFieldTemplate() {
  return function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
    const path = props.fieldPathId.path.join(".");
    const relation = relationToLayout(path, props.registry.formContext as LayoutFormContext);
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
  const presentationAdapter = presentation?.registry.get(presentation.adapterId);
  if (presentation && !presentationAdapter) {
    throw new Error(`Presentation adapter '${presentation.adapterId}' is not registered.`);
  }
  const { ButtonTemplates: adapterButtonTemplates, ...adapterTemplates } = presentationAdapter?.templates ?? {};
  const [records, setRecords] = useState<Readonly<Record<string, ValidationRecord>>>({});
  const [pending, setPending] = useState<Readonly<Record<string, string>>>({});
  const latestValue = useRef<JsonObject>(value ?? {});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const requestVersions = useRef(new Map<string, number>());
  latestValue.current = value ?? latestValue.current;

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    asyncValidation?.engine.cancelAll();
  }, [asyncValidation?.engine]);

  const rules = spec.validations?.async ?? [];
  const recordKey = (rule: AsyncValidationRuleSpec, fieldPath: string) => `${rule.id}:${fieldPath}`;

  const runRule = async (
    rule: AsyncValidationRuleSpec,
    fieldPath: string,
    trigger: AsyncValidationTrigger,
    formData: JsonObject,
  ): Promise<AsyncValidationResult | undefined> => {
    if (!asyncValidation) return undefined;
    const key = recordKey(rule, fieldPath);
    const version = (requestVersions.current.get(key) ?? 0) + 1;
    requestVersions.current.set(key, version);
    setPending((current) => ({ ...current, [key]: fieldPath }));
    setRecords((current) => {
      const { [key]: removed, ...remaining } = current;
      void removed;
      return remaining;
    });

    const result = await asyncValidation.engine.run({
      rule,
      fieldPath,
      value: valueAtPath(formData, fieldPath),
      formData,
      trigger,
    });
    if (requestVersions.current.get(key) !== version) return result;

    setPending((current) => {
      const { [key]: removed, ...remaining } = current;
      void removed;
      return remaining;
    });
    if (result.status !== "cancelled") {
      setRecords((current) => ({ ...current, [key]: { fieldPath, result } }));
      asyncValidation.onResult?.({ ruleId: rule.id, fieldPath, trigger, result });
    }
    return result;
  };

  const scheduleChangeRule = (
    rule: AsyncValidationRuleSpec,
    fieldPath: string,
    formData: JsonObject,
  ): void => {
    const key = recordKey(rule, fieldPath);
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    const debounceMs = rule.debounceMs ?? 0;
    if (debounceMs === 0) {
      void runRule(rule, fieldPath, "change", formData);
      return;
    }
    setPending((current) => ({ ...current, [key]: fieldPath }));
    timers.current.set(key, setTimeout(() => {
      timers.current.delete(key);
      void runRule(rule, fieldPath, "change", formData);
    }, debounceMs));
  };

  const placements: Record<string, GridPlacement> = {};
  const order: Record<string, number> = {};
  collectLayout(spec.layout, viewport, placements, order);
  const asyncFields: Record<string, AsyncFieldState> = {};
  Object.values(records).forEach(({ fieldPath, result }) => {
    const previous = asyncFields[fieldPath];
    asyncFields[fieldPath] = {
      status: result.status,
      issues: [...(previous?.issues ?? []), ...(result.issues ?? [])],
      blocking: result.blocking || (previous?.blocking ?? false),
    };
  });
  Object.values(pending).forEach((fieldPath) => {
    asyncFields[fieldPath] = {
      status: "pending",
      issues: asyncFields[fieldPath]?.issues ?? [],
      blocking: asyncFields[fieldPath]?.blocking ?? false,
    };
  });
  const formContext: LayoutFormContext = {
    placements,
    order,
    layoutPaths: Object.keys(placements),
    asyncFields,
    ...(presentationAdapter?.templates?.FieldTemplate
      ? { presentationFieldTemplate: presentationAdapter.templates.FieldTemplate }
      : {}),
  };
  const extraErrors: ErrorSchema = {};
  Object.values(records).forEach(({ fieldPath, result }) => {
    if (!result.blocking) return;
    const messages = result.issues?.map(({ message }) => message) ?? ["Async validation failed."];
    messages.forEach((message) => addError(extraErrors, fieldPath, message));
  });
  const isPending = Object.keys(pending).length > 0;
  const SubmitButton = () => (
    <button className="a-form-submit" disabled={isPending} type="submit">
      {submitLabel}
    </button>
  );

  return (
    <Form
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
        for (const rule of rules) {
          if (rule.paths.includes(fieldPath) && appliesToTrigger(rule, "blur")) {
            const key = recordKey(rule, fieldPath);
            const timer = timers.current.get(key);
            if (timer) {
              clearTimeout(timer);
              timers.current.delete(key);
            }
            void runRule(rule, fieldPath, "blur", latestValue.current);
          }
        }
      }}
      onChange={({ formData }) => {
        const nextValue = (formData ?? {}) as JsonObject;
        const previousValue = latestValue.current;
        latestValue.current = nextValue;
        onChange?.(nextValue);
        for (const rule of rules) {
          if (!appliesToTrigger(rule, "change")) continue;
          const watchedPaths = [...rule.paths, ...(rule.dependsOn ?? [])];
          const changed = watchedPaths.some((path) => (
            valueAtPath(previousValue, path) !== valueAtPath(nextValue, path)
          ));
          if (!changed) continue;
          for (const fieldPath of rule.paths) {
            scheduleChangeRule(rule, fieldPath, nextValue);
          }
        }
      }}
      onSubmit={async ({ formData }, event) => {
        const submittedValue = (formData ?? {}) as JsonObject;
        latestValue.current = submittedValue;
        timers.current.forEach(clearTimeout);
        timers.current.clear();
        setPending({});
        const results = await Promise.all(rules.filter((rule) => (
          appliesToTrigger(rule, "submit") || appliesToTrigger(rule, "change")
        )).flatMap((rule) => {
          const trigger = appliesToTrigger(rule, "submit") ? "submit" : "change";
          return rule.paths.map((fieldPath) => runRule(rule, fieldPath, trigger, submittedValue));
        }));
        if (results.some((result) => result?.blocking)) return;
        onSubmit?.(submittedValue, event);
      }}
      {...(presentationAdapter?.fields ? { fields: presentationAdapter.fields } : {})}
      {...(presentationAdapter?.widgets ? { widgets: presentationAdapter.widgets } : {})}
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