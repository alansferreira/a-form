import type { WidgetProps } from "@rjsf/utils";
import type { JsonObject, JsonValue } from "a-form-core";
import { renderTemplate, renderUrlTemplate } from "a-form-template";
import { useEffect, useRef, useState } from "react";

function DateWidget(props: WidgetProps) {
  return (
    <input
      className="a-form-native-widget"
      disabled={props.disabled || props.readonly}
      id={props.id}
      required={props.required}
      type="date"
      value={typeof props.value === "string" ? props.value : ""}
      onBlur={(event) => props.onBlur?.(props.id, event.target.value)}
      onChange={(event) => props.onChange(event.target.value || undefined)}
    />
  );
}

function TimeWidget(props: WidgetProps) {
  return (
    <input
      className="a-form-native-widget"
      disabled={props.disabled || props.readonly}
      id={props.id}
      required={props.required}
      type="time"
      value={typeof props.value === "string" ? props.value : ""}
      onBlur={(event) => props.onBlur?.(props.id, event.target.value)}
      onChange={(event) => props.onChange(event.target.value || undefined)}
    />
  );
}

function DateTimeWidget(props: WidgetProps) {
  return (
    <input
      className="a-form-native-widget"
      disabled={props.disabled || props.readonly}
      id={props.id}
      required={props.required}
      type="datetime-local"
      value={typeof props.value === "string" ? props.value : ""}
      onBlur={(event) => props.onBlur?.(props.id, event.target.value)}
      onChange={(event) => props.onChange(event.target.value || undefined)}
    />
  );
}

function RangeWidget(props: WidgetProps) {
  const options = props.options as Record<string, unknown>;
  const min = typeof options.min === "number" ? options.min : (typeof props.schema.minimum === "number" ? props.schema.minimum : 0);
  const max = typeof options.max === "number" ? options.max : (typeof props.schema.maximum === "number" ? props.schema.maximum : 100);
  const step = typeof options.step === "number" ? options.step : 1;
  const value = typeof props.value === "number" ? props.value : min;

  return (
    <span className="a-form-range-widget">
      <input
        disabled={props.disabled || props.readonly}
        id={props.id}
        max={max}
        min={min}
        step={step}
        type="range"
        value={value}
        onBlur={(event) => props.onBlur?.(props.id, Number(event.target.value))}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
      <output htmlFor={props.id}>{value}</output>
    </span>
  );
}

interface ResolvedOption {
  readonly value: JsonValue;
  readonly label: string;
}

/** Maps a raw options array (static list or fetch response) into { value, label } pairs. */
export function resolveAsyncOptions(source: unknown, options: {
  readonly valueKey?: string;
  readonly labelKey?: string;
  readonly itemTemplate?: string;
}): readonly ResolvedOption[] {
  if (!Array.isArray(source)) return [];
  const valueKey = options.valueKey ?? "value";
  const labelKey = options.labelKey ?? "label";
  return source.map((item): ResolvedOption => {
    const record = item !== null && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : undefined;
    const value = (record?.[valueKey] ?? item) as JsonValue;
    const label = options.itemTemplate
      ? renderTemplate(options.itemTemplate, { item } as unknown as JsonObject)
      : String(record?.[labelKey] ?? value);
    return { value, label };
  });
}

/**
 * Default autocomplete/asyncOptions widget: a native text input backed by a <datalist>.
 * `ui:options.source` is either a static array of items or a Mustache URL template
 * (rendered against the whole form's data plus the typed `query`) fetched on each keystroke.
 */
function AsyncOptionsWidget(props: WidgetProps) {
  const options = props.options as Record<string, unknown>;
  const source = options.source;
  const valueKey = typeof options.valueKey === "string" ? options.valueKey : undefined;
  const labelKey = typeof options.labelKey === "string" ? options.labelKey : undefined;
  const itemTemplate = typeof options.itemTemplate === "string" ? options.itemTemplate : undefined;
  const debounceMs = typeof options.debounceMs === "number" ? options.debounceMs : 300;
  const rootFormData = (props.registry.formContext as { rootFormData?: JsonObject } | undefined)?.rootFormData ?? {};

  const staticOptions = Array.isArray(source)
    ? resolveAsyncOptions(source, { ...(valueKey ? { valueKey } : {}), ...(labelKey ? { labelKey } : {}), ...(itemTemplate ? { itemTemplate } : {}) })
    : undefined;
  const [fetchedOptions, setFetchedOptions] = useState<readonly ResolvedOption[]>([]);
  const [query, setQuery] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (typeof source !== "string") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const url = renderUrlTemplate(source, { ...rootFormData, query } as JsonObject);
      fetch(url)
        .then((response) => response.json())
        .then((data) => setFetchedOptions(resolveAsyncOptions(data, { ...(valueKey ? { valueKey } : {}), ...(labelKey ? { labelKey } : {}), ...(itemTemplate ? { itemTemplate } : {}) })))
        .catch(() => setFetchedOptions([]));
    }, debounceMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, query, JSON.stringify(rootFormData)]);

  const items = staticOptions ?? fetchedOptions;
  const datalistId = `${props.id}-options`;

  return (
    <>
      <input
        className="a-form-native-widget"
        disabled={props.disabled || props.readonly}
        id={props.id}
        list={datalistId}
        value={query}
        onBlur={(event) => props.onBlur?.(props.id, event.target.value)}
        onChange={(event) => {
          const raw = event.target.value;
          setQuery(raw);
          const match = items.find((item) => item.label === raw);
          props.onChange(match ? match.value : (raw || undefined));
        }}
      />
      <datalist id={datalistId}>
        {items.map((item) => <option key={item.label} value={item.label} />)}
      </datalist>
    </>
  );
}

export const defaultWidgets = {
  date: DateWidget,
  time: TimeWidget,
  datetime: DateTimeWidget,
  range: RangeWidget,
  autocomplete: AsyncOptionsWidget,
  asyncOptions: AsyncOptionsWidget,
};
