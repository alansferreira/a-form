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
  ColumnAlign,
  JsonObject,
  JsonValue,
  NormalizedFieldNode,
  NormalizedFormSpec,
} from "a-form-core";
import { renderTemplate } from "a-form-template";
import type { PanelTemplateProps, PresentationConfig } from "./presentation.js";
import { defaultWidgets } from "./widgets.js";
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
  readonly fieldSpans: Readonly<Record<string, number>>;
  readonly fieldAlign: Readonly<Record<string, ColumnAlign>>;
  readonly order: Readonly<Record<string, number>>;
  readonly layoutPaths: readonly string[];
  readonly asyncFields: Readonly<Record<string, AsyncFieldState>>;
  readonly presentationFieldTemplate?: ComponentType<FieldTemplateProps>;
  readonly panels: readonly PanelGroup[];
  readonly pathToPanel: Readonly<Record<string, string>>;
  readonly panelFrames: Readonly<Record<string, PanelFramePlacement>>;
  readonly presentationPanelTemplate?: ComponentType<PanelTemplateProps>;
  readonly rootFormData: JsonObject;
}

interface PanelGroup {
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
}

interface PanelFramePlacement {
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly order: number;
}

function panelTitleId(panelId: string): string {
  return `a-form-panel-title-${panelId}`;
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

interface CollectedLayout {
  readonly fieldSpans: Record<string, number>;
  readonly fieldAlign: Record<string, ColumnAlign>;
  readonly order: Record<string, number>;
  readonly panels: PanelGroup[];
  readonly pathToPanel: Record<string, string>;
  readonly panelFrames: Record<string, PanelFramePlacement>;
}

function spanForViewport(field: NormalizedFieldNode, viewport: AFormViewport): number {
  return field.span[viewport];
}

/**
 * Packs fields into 12-column rows exactly like the CSS grid engine will (greedy left-to-right,
 * wrapping once a row runs out of space), so the browser—not the spec author—decides line breaks.
 * The simulation only drives the decorative panel frame; actual fields rely on native grid auto-flow.
 */
function collectFormLayout(layout: NormalizedFormSpec["layout"], viewport: AFormViewport): CollectedLayout {
  const fieldSpans: Record<string, number> = {};
  const fieldAlign: Record<string, ColumnAlign> = {};
  const order: Record<string, number> = {};
  const panels: PanelGroup[] = [];
  const pathToPanel: Record<string, string> = {};
  const panelFrames: Record<string, PanelFramePlacement> = {};
  let cursor = 0;
  let row = 1;

  const placeField = (field: NormalizedFieldNode, panelId?: string): void => {
    const span = spanForViewport(field, viewport);
    if (cursor > 0 && cursor + span > 12) {
      row += 1;
      cursor = 0;
    }
    fieldSpans[field.path] = span;
    fieldAlign[field.path] = field.align;
    order[field.path] = Object.keys(order).length;
    if (panelId) pathToPanel[field.path] = panelId;
    cursor += span;
  };

  for (const node of layout) {
    if (node.type === "panel") {
      if (cursor > 0) {
        row += 1;
        cursor = 0;
      }
      const rowStart = row;
      const panelOrder = Object.keys(order).length;
      node.children.forEach((field) => placeField(field, node.id));
      panels.push({ id: node.id, ...(node.title !== undefined ? { title: node.title } : {}), ...(node.description !== undefined ? { description: node.description } : {}) });
      panelFrames[node.id] = { rowStart, rowEnd: row + 1, order: panelOrder };
      if (cursor > 0) {
        row += 1;
        cursor = 0;
      }
    } else {
      placeField(node);
    }
  }

  return { fieldSpans, fieldAlign, order, panels, pathToPanel, panelFrames };
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
        data-a-form-panel={relation.exact ? context.pathToPanel[path] : undefined}
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

function DefaultPanelTemplate({ id, title, description }: PanelTemplateProps): ReactNode {
  return (
    <div className="a-form-panel-frame">
      {title && <span className="a-form-panel-title" id={panelTitleId(id)}>{title}</span>}
      {description && <span className="a-form-panel-description">{description}</span>}
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
        {path === "" && context.panels.map((panel) => {
          const frame = context.panelFrames[panel.id];
          if (!frame) return null;
          const PanelComponent = context.presentationPanelTemplate ?? DefaultPanelTemplate;
          return (
            <div
              key={panel.id}
              className="a-form-panel"
              data-a-form-panel={panel.id}
              style={{ gridColumn: "1 / 13", gridRow: `${frame.rowStart} / ${frame.rowEnd}`, order: frame.order, pointerEvents: "none" } as CSSProperties}
            >
              <PanelComponent id={panel.id} {...(panel.title !== undefined ? { title: panel.title } : {})} {...(panel.description !== undefined ? { description: panel.description } : {})} />
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

  const { fieldSpans, fieldAlign, order, panels, pathToPanel, panelFrames } = collectFormLayout(spec.layout, viewport);
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
    fieldSpans,
    fieldAlign,
    order,
    layoutPaths: Object.keys(fieldSpans),
    asyncFields,
    panels,
    pathToPanel,
    panelFrames,
    rootFormData: value ?? {},
    ...(presentationAdapter?.templates?.FieldTemplate
      ? { presentationFieldTemplate: presentationAdapter.templates.FieldTemplate }
      : {}),
    ...(presentationAdapter?.templates?.PanelTemplate
      ? { presentationPanelTemplate: presentationAdapter.templates.PanelTemplate }
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